# -*- coding: utf-8 -*-
"""Extract the 700-question bank from the source markdown into JSON and JS.

The source is a PDF-to-markdown conversion. It contains:
  - 3 chapters (256 + 304 + 140 = 700 questions)
  - questions numbered 1..N inside each chapter
  - answer keys as markdown tables, one per chapter
  - page numbers and page-break artifacts
  - a handful of question headers concatenated onto the previous option line

This script normalizes those artifacts without rewriting question content.
It also recovers answers for questions that are exact duplicates of an
answered question elsewhere in the same source file, and marks the remaining
questions as "missing answer in source" so the website can exclude them from
scoring.
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "700tracnghiemlsdcsvn_Copy.md"
OUT = ROOT / "data" / "questions.json"
REPORT = ROOT / "data" / "extraction-report.txt"
DATA_JS = ROOT / "assets" / "data.js"

QUESTION_RE = re.compile(r"^\s*(?:#+\s*)?(?:\*\*)?Câu\s+(\d+)\s*[:.]\s*(.*)$", re.I)
CHAPTER_RE = re.compile(r"^\s*(?:#+\s*)?(?:\*\*)?CHƯƠNG\s+(\d+)\s*[:.]\s*(.*)$", re.I)
ANSWER_KEY_RE = re.compile(r"^\s*#?\s*GỢI Ý ĐÁP ÁN\s*$", re.I)
OPTION_RE = re.compile(r"^\s*\*?\s*(?:(\d{1,2})[.)]|([A-Da-d])[.)])\s*(.*)$")
PAGE_RE = re.compile(r"^\s*\d{1,3}\s*$")
ANSWER_CELL_RE = re.compile(r"Câu\s*(\d+)\s*\|\s*([A-D])\b")

PERIOD_BY_CHAPTER = {
    1: "1930 – 1945",
    2: "1945 – 1975",
    3: "1975 – nay",
}


def clean_inline(text: str) -> str:
    text = text.replace("\u00a0", " ")
    text = re.sub(r"</?u>", "", text, flags=re.I)
    text = text.replace("**", "")
    text = re.sub(r"^\s*#+\s*", "", text)
    # The PDF-to-markdown splitter leaves a '#' at the end of the option
    # before an inline 'Câu N:' heading. It has no meaning in the content.
    text = text.replace("#", "")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def normalize_key(text: str) -> str:
    """Normalize text for conservative duplicate detection.

    Diacritics are kept: two questions are only considered duplicates when
    their wording is effectively identical, not merely similar.
    """
    text = unicodedata.normalize("NFC", clean_inline(text).lower())
    text = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def split_embedded_questions(lines: list[str]) -> list[str]:
    """Split a line that contains an inline 'Câu N:' header.

    PDF extraction joined a few question headers to the last option of the
    previous question. Splitting restores one logical line per element.
    """
    out: list[str] = []
    for line in lines:
        parts = re.split(r"(?=(?:\*\*)?Câu\s+\d+\s*[:.])", line)
        out.extend(part for part in parts if part.strip())
    return out


def parse() -> tuple[list[dict], list[dict], list[str]]:
    raw_lines = SOURCE.read_text(encoding="utf-8").splitlines()
    lines = split_embedded_questions(raw_lines)

    chapters: list[dict] = []
    current_chapter: dict | None = None
    current_question: dict | None = None
    current_options: list[str] = []
    current_text: list[str] = []
    in_answer_key = False
    answer_key_index = -1
    answer_keys: list[dict[int, str]] = []
    warnings: list[str] = []

    def finish_option() -> None:
        nonlocal current_options
        if current_options:
            current_options[-1] = clean_inline(current_options[-1])

    def finish_question() -> None:
        nonlocal current_question, current_options, current_text
        if current_question is None:
            return
        text = clean_inline(" ".join(current_text))
        opts = [clean_inline(o) for o in current_options]
        current_question["text"] = text
        current_question["options"] = opts
        current_chapter["questions"].append(current_question)
        current_question = None
        current_options = []
        current_text = []

    for line in lines:
        line = line.replace("**", "")
        stripped = line.strip()

        m = CHAPTER_RE.match(line)
        if m:
            finish_question()
            current_chapter = {
                "number": int(m.group(1)),
                "title": clean_inline(m.group(2)),
                "questions": [],
            }
            chapters.append(current_chapter)
            in_answer_key = False
            current_text = []
            continue

        if ANSWER_KEY_RE.match(line):
            finish_question()
            in_answer_key = True
            answer_keys.append({})
            answer_key_index = len(answer_keys) - 1
            continue

        if in_answer_key:
            for am in ANSWER_CELL_RE.finditer(line):
                answer_keys[answer_key_index][int(am.group(1))] = am.group(2)
            continue

        m = QUESTION_RE.match(line)
        if m:
            finish_question()
            if current_chapter is None:
                current_chapter = {"number": 1, "title": "", "questions": []}
                chapters.append(current_chapter)
            current_question = {"number": int(m.group(1))}
            current_text = [m.group(2)]
            current_options = []
            continue

        if current_question is None:
            continue

        if PAGE_RE.match(line):
            continue

        om = OPTION_RE.match(line)
        if om:
            finish_option()
            current_options.append(om.group(3))
            continue

        # Continuation of the question or the last option.
        if current_options:
            current_options[-1] += " " + stripped
        else:
            current_text.append(stripped)

    finish_question()

    # Attach answers chapter by chapter.
    for idx, chapter in enumerate(chapters):
        key = answer_keys[idx] if idx < len(answer_keys) else {}
        for q in chapter["questions"]:
            q["answer"] = key.get(q["number"])
            q["answerSource"] = "key" if q["answer"] else "missing"
            q["answerFrom"] = "Gợi ý đáp án" if q["answer"] else None
            if q["answer"] is None:
                warnings.append(
                    f"Chương {chapter['number']} câu {q['number']}: thiếu đáp án trong file gốc"
                )
            if len(q["options"]) != 4:
                warnings.append(
                    f"Chương {chapter['number']} câu {q['number']}: {len(q['options'])} lựa chọn"
                )

    return chapters, answer_keys, warnings


def recover_exact_duplicate_answers(chapters: list[dict]) -> list[dict]:
    """Recover answers from exact duplicate questions in the same source.

    A question is only recovered when:
      - its normalized wording is identical to an answered question, and
      - the set of normalized options is identical, and
      - the correct option text maps to exactly one option in the target.

    If duplicate candidates disagree, the question stays unscored.
    """
    known: list[tuple[dict, dict]] = []
    for chapter in chapters:
        for question in chapter["questions"]:
            if question.get("answer"):
                known.append((chapter, question))

    recovered: list[dict] = []
    for chapter in chapters:
        for question in chapter["questions"]:
            if question.get("answer"):
                continue
            q_key = normalize_key(question["text"])
            if not q_key:
                continue
            q_options = sorted(normalize_key(o) for o in question["options"])
            matches: list[tuple[dict, dict, int]] = []

            for known_chapter, known_question in known:
                if normalize_key(known_question["text"]) != q_key:
                    continue
                k_options = sorted(normalize_key(o) for o in known_question["options"])
                if q_options != k_options:
                    continue
                ans_idx = "ABCD".index(known_question["answer"])
                ans_text = normalize_key(known_question["options"][ans_idx])
                target_idxs = [
                    i
                    for i, option in enumerate(question["options"])
                    if normalize_key(option) == ans_text
                ]
                if len(target_idxs) == 1:
                    matches.append((known_chapter, known_question, target_idxs[0]))

            if not matches:
                continue

            letters = {"ABCD"[idx] for _, _, idx in matches}
            if len(letters) != 1:
                # Conflicting duplicates: do not guess.
                continue

            letter = letters.pop()
            known_chapter, known_question, _ = matches[0]
            question["answer"] = letter
            question["answerSource"] = "duplicate"
            question["answerFrom"] = (
                f"Trùng với Chương {known_chapter['number']} câu {known_question['number']}"
            )
            recovered.append(
                {
                    "chapter": chapter["number"],
                    "number": question["number"],
                    "answer": letter,
                    "fromChapter": known_chapter["number"],
                    "fromNumber": known_question["number"],
                    "text": question["text"],
                }
            )

    return recovered


def build_units(chapters: list[dict]) -> tuple[list[dict], list[dict]]:
    flat: list[dict] = []
    for chapter in chapters:
        for question in chapter["questions"]:
            flat.append(
                {
                    "gid": len(flat) + 1,
                    "chapterNumber": chapter["number"],
                    "chapterTitle": chapter["title"],
                    "chapterQuestionNumber": question["number"],
                    "text": question["text"],
                    "options": question["options"],
                    "answer": question.get("answer"),
                    "answerSource": question.get("answerSource", "missing"),
                    "answerFrom": question.get("answerFrom"),
                }
            )

    units: list[dict] = []
    for start in range(0, len(flat), 50):
        questions = flat[start : start + 50]
        unit_number = len(units) + 1
        chapter_numbers = sorted({q["chapterNumber"] for q in questions})
        if len(chapter_numbers) == 1:
            chapter_label = f"Chương {chapter_numbers[0]}"
        else:
            chapter_label = f"Chương {chapter_numbers[0]} → {chapter_numbers[-1]}"
        periods = [PERIOD_BY_CHAPTER.get(n, "") for n in chapter_numbers]
        period_label = periods[0] if len(periods) == 1 else f"{periods[0]} → {periods[-1]}"
        units.append(
            {
                "id": unit_number,
                "name": f"Unit {unit_number}",
                "chapterLabel": chapter_label,
                "periodLabel": period_label,
                "rangeLabel": f"Câu {start + 1}–{start + len(questions)}",
                "questionCount": len(questions),
                "missingCount": sum(1 for q in questions if not q.get("answer")),
                "questions": questions,
            }
        )
    return flat, units


def main() -> None:
    chapters, answer_keys, warnings = parse()
    recovered = recover_exact_duplicate_answers(chapters)
    flat, units = build_units(chapters)
    total = len(flat)
    answered = sum(1 for q in flat if q.get("answer"))
    missing = total - answered
    key_count = sum(1 for q in flat if q.get("answerSource") == "key")
    duplicate_count = sum(1 for q in flat if q.get("answerSource") == "duplicate")
    missing_by_chapter = {
        c["number"]: sum(1 for q in c["questions"] if not q.get("answer"))
        for c in chapters
    }

    report = [
        "BÁO CÁO TRÍCH XUẤT DỮ LIỆU",
        f"Nguồn: {SOURCE.name}",
        f"Tổng số câu: {total}",
        f"Có đáp án: {answered} (gợi ý gốc: {key_count}, phục hồi từ câu trùng: {duplicate_count})",
        f"Chưa có đáp án trong nguồn: {missing}",
        "",
    ]
    for chapter in chapters:
        chapter_answered = sum(1 for q in chapter["questions"] if q.get("answer"))
        report.append(
            f"Chương {chapter['number']}: {len(chapter['questions'])} câu, "
            f"{chapter_answered} có đáp án, "
            f"{len(chapter['questions']) - chapter_answered} chưa có đáp án | {chapter['title']}"
        )
        nums = [q["number"] for q in chapter["questions"]]
        expected = set(range(1, max(nums) + 1)) if nums else set()
        missing_numbers = sorted(expected - set(nums))
        if missing_numbers:
            report.append(f"  Thiếu số câu: {missing_numbers}")
        dupes = sorted({n for n in nums if nums.count(n) > 1})
        if dupes:
            report.append(f"  Số câu trùng: {dupes}")
    report.extend(
        [
            "",
            f"Answer keys: {[len(k) for k in answer_keys]}",
            f"Câu trùng đã phục hồi đáp án: {len(recovered)}",
        ]
    )
    for item in recovered:
        report.append(
            f"  Chương {item['chapter']} câu {item['number']} ← "
            f"Chương {item['fromChapter']} câu {item['fromNumber']} "
            f"({item['answer']}) | {item['text'][:100]}"
        )
    report.extend(["", "Các Unit (50 câu/Unit):"])
    for unit in units:
        report.append(
            f"  {unit['name']}: {unit['chapterLabel']} | {unit['periodLabel']} | "
            f"{unit['rangeLabel']} | {unit['missingCount']} câu chưa có đáp án"
        )
    report.extend(["", f"Warnings: {len(warnings)}"])
    report.extend("  " + w for w in warnings)

    payload = {
        "title": "700 câu hỏi trắc nghiệm Lịch sử Đảng Cộng sản Việt Nam",
        "source": SOURCE.name,
        "stats": {
            "total": total,
            "answered": answered,
            "missing": missing,
            "key": key_count,
            "recovered": duplicate_count,
            "missingByChapter": missing_by_chapter,
        },
        "chapters": [
            {
                "number": c["number"],
                "title": c["title"],
                "questionCount": len(c["questions"]),
                "missingCount": sum(1 for q in c["questions"] if not q.get("answer")),
            }
            for c in chapters
        ],
        "units": units,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {
                "title": payload["title"],
                "source": payload["source"],
                "stats": payload["stats"],
                "chapters": [
                    {
                        "number": c["number"],
                        "title": c["title"],
                        "questions": c["questions"],
                    }
                    for c in chapters
                ],
            },
            ensure_ascii=False,
            indent=1,
        ),
        encoding="utf-8",
    )
    REPORT.write_text("\n".join(report), encoding="utf-8")
    DATA_JS.parent.mkdir(parents=True, exist_ok=True)
    DATA_JS.write_text(
        "window.QUIZ_DATA = "
        + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )

    print("\n".join(report[:45]))
    print(f"\nWrote {OUT} ({OUT.stat().st_size:,} bytes)")
    print(f"Wrote {DATA_JS} ({DATA_JS.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
