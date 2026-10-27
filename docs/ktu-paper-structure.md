# Anatomy of a KTU end-semester question paper

**Observed from real KTU question papers and KTU-published model question papers.**
University: APJ Abdul Kalam Technological University (KTU), Kerala. Schemes covered: **2024 scheme** (primary) and **2019 scheme** (comparison).

> **How this document was produced / provenance rules**
> Every quoted line below is verbatim from the source listed in §7. Nothing here is invented.
> Paper text was obtained by fetching public mirrors of the university papers (Google Drive copies hosted by KTU
> aggregator sites, Scribd uploads of scanned/photocopied university papers) through a text-extraction reader
> (`https://r.jina.ai/<url>`). Papers are distributed by KTU as PDFs; the extractor returns their text layer.
> Where the extractor garbled a line (typical for scanned/OCR pages), the quote is marked `[OCR]` and left as-is.
> Normalisations applied silently: run-together header words re-spaced, superscripts flattened to `x2`/`x^3` style
> plain text, and long questions kept on one line. Wording, marks and numbering are unchanged.

---

## 1. Header block

### 1.1 2024-scheme **real end-semester papers** (three independent examples)

**(a) UCEST105 — Algorithmic Thinking with Python, S1 regular, December 2024** (Scribd mirror, solved-paper upload):

```
03 UCEST105 122402
Page 1 of 4

APJ ABDUL KALAM TECHNOLOGICAL UNIVERSITY
First Semester B.Tech Degree Regular Examination December 2024 (2024 Scheme)
Reg No.:_______________ Name:__________________________

Course Code: UCEST105
Course Name: ALGORITHMIC THINKING WITH PYTHON
Max. Marks: 60                               Duration: 2 hours 30 minutes
```

**(b) GAMAT101 — Mathematics for Information Science-1, S1 regular, December 2024** (KTU aggregator mirror):

```
03GAMAT101122402
Page 1 of 3

Course Code: GAMAT101
Course Name: MATHEMATICS FOR INFORMATION SCIENCE-1
Max. Marks: 60                               Duration: 2 hours 30 minutes
...
A Pages: 3

APJ ABDUL KALAM TECHNOLOGICAL UNIVERSITY
First Semester B.Tech Degree Regular Examination December 2024 (2024 Scheme)
Reg No.:_______________ Name:__________________________
```

**(c) GAMAT101 — S1 supplementary, May 2025** (same course, later session — note the session wording and the
different paper code suffix):

```
03GAMAT101122403X
Page 1 of 3

Course Code: GAMAT101
Course Name: MATHEMATICS FOR INFORMATION SCIENCE-1
Max. Marks: 60                               Duration: 2 hours 30 minutes
...
A Pages: 3

APJ ABDUL KALAM TECHNOLOGICAL UNIVERSITY
B.Tech Degree S1 (S) Examination May 2025 (2024 Scheme)
Reg No.:_______________ Name:__________________________
```

**(d) PCCST303 — Data Structures and Algorithms, S3 (R) (FT/WP), November 2025** (third-year 2024-scheme paper;
scanned copy, so partly `[OCR]`):

```
[OCR] 06PCCST303112503
[OCR] C                 Re8No.:            Max. M
[OCR] Name:
[OCR] Ap] ABI]uL KALAn¢ TECHNOLOGICAL uN]
[OCR] B.Tech Degree S3 (R) (FT/WP) Examination November 20
[OCR] Course code: PCCST303
[OCR] Course Name: DATA ST[RUCTURES A]ND ALGORITHMS
      - Duration: 2 hours 30 minutes
[OCR] (Answer all questions. Each ... carries 3 marks)
```

### 1.2 2024-scheme **KTU model question papers** (published model paper set, S1)

Model papers carry the literal label **MODEL QUESTION PAPER** and a placeholder month/year. Two verbatim examples:

**UCEST105 model paper:**

```
MODEL QUESTION PAPER

APJ ABDUL KALAM TECHNOLOGICAL UNIVERSITY
FIRST SEMESTER B. TECH DEGREE EXAMINATION, DECEMBER 2024

Course Code: UCEST105
Course Name: Algorithmic Thinking with Python
Max. Marks: 60   Duration: 2 hours 30 minutes
```

**GAMAT101 model paper:**

```
MODEL QUESTION PAPER

APJ ABDUL KALAM TECHNOLOGICAL UNIVERSITY
FIRST SEMESTER B. TECH DEGREE EXAMINATION, DEC 2024

Course Code: GAMAT101
Course Name: MATHEMATICS FOR INFORMATION SCIENCE-1
Max. Marks: 60 Duration: 2 hours 30 minutes
```

**GAPHT121 model paper** (a third model paper in the same set, quoted only for its header — note the
`FIRST/SECOND SEMESTER` variant used for group-shared courses):

```
MODEL QUESTION PAPER

APJ ABDUL KALAM TECHNOLOGICAL UNIVERSITY FIRST/SECOND SEMESTER B. TECH DEGREE EXAMINATION, MONTH AND YEAR

Course Code: GAPHT121
Course Name: Physics for Information Science
Max. Marks: 60 Duration: 2 hours 30 minutes
```

### 1.3 2019-scheme papers (for contrast)

**(a) HUT300 — Industrial Economics & Foreign Trade, S6 (R&S), July 2023** (valuation scheme for a real paper;
it reproduces the paper header verbatim):

```
1200HUT300052301
Page 1of 7
DRAFT Scheme of Valuation/Answer Key
(Scheme of evaluation (marks in brackets) and answers of problems/key)

APJ ABDUL KALAM TECHNOLOGICAL UNIVERSITY
SIXTH SEMESTER B. TECH DEGREE (R&S) EXAMINATION, JULY 2023

Course Code: HUT300
Course Name: INDUSTRIAL ECONOMICS & FOREIGN TRADE
Max. Marks: 100
Duration: 3 Hours
```

**(b) MAT 206 — Graph Theory, S4 (2019-scheme model question paper from the syllabus):**

```
APJ ABDUL KALAM TECHNOLOGICAL UNIVERSITY FOURTH SEMESTER B.TECH DEGREE EXAMINATION

Course Code: MAT 206
Course name: Graph Theory
Max Marks: 100
Duration: 3 Hours
```

### 1.4 Header/layout quirks actually observed

| Element | 2024 scheme | 2019 scheme |
|---|---|---|
| University line | `APJ ABDUL KALAM TECHNOLOGICAL UNIVERSITY` (upper case, on its own line above the exam line) | Same wording; on the MAT 206 model paper it is run into the semester line: `APJ ABDUL KALAM TECHNOLOGICAL UNIVERSITY FOURTH SEMESTER B.TECH DEGREE EXAMINATION` |
| Exam line | `First Semester B.Tech Degree Regular Examination December 2024 (2024 Scheme)` / `B.Tech Degree S1 (S) Examination May 2025 (2024 Scheme)` / `B.Tech Degree S3 (R) (FT/WP) Examination November 20…` — **the scheme tag `(2024 Scheme)` is printed in the exam line** | `SIXTH SEMESTER B. TECH DEGREE (R&S) EXAMINATION, JULY 2023` — no scheme tag; `(R&S)` = Regular & Supplementary |
| Register-number boxes | `Reg No.:_______________ Name:__________________________` (underscore rules, not boxed squares) | Not present on the valuation-scheme copy fetched; the copy is the scheme of valuation, not the candidate sheet |
| Page count | A right-hand box on page 1 reading `Pages: 3` (extracted as `A Pages: 3`, the `A` being an extraction artifact of the box/border) | Not observed on the fetched copy |
| Running page footers | Each page carries `Page 1 of 3`, `Page 2 of 3`, `Page 3 of 3` (UCEST105: `Page 1 of 4` … `Page 4 of 4`) | `Page 1of 7` … on the valuation scheme |
| Per-page routing code | A 15-character code line at the top of every page, e.g. `03GAMAT101122402`, `03GAMAT101122403X`, `03 UCEST105 122402`, `06PCCST303112503` — looks like `<centre/stream><course><session><serial>` | `1200HUT300052301` |
| Course identification | Two labelled lines: `Course Code:` and `Course Name:` (UCEST105 2024 real paper prints the name in ALL CAPS: `ALGORITHMIC THINKING WITH PYTHON`) | Same two lines: `Course Code: HUT300` / `Course Name: INDUSTRIAL ECONOMICS & FOREIGN TRADE` |
| Marks/duration line | `Max. Marks: 60` + `Duration: 2 hours 30 minutes`, usually on one line, right-aligned block | `Max. Marks: 100` / `Duration: 3 Hours` on separate lines |
| End-of-paper marker | Model papers end with `*****`; the real UCEST105 Dec-2024 extraction shows no end marker | `OR` separators are printed explicitly (see §2) |

---

## 2. Part structure

### 2.1 2024 scheme — 60 marks, 2 hours 30 minutes, **two parts, 4 modules**

Verbatim instruction lines (real papers):

```
PART A
(Answer all questions. Each question carries 3 marks)
CO Marks
```

```
PART B
(Answer any one full question from each module, each question carries 9 marks)
```

* **Part A: 8 questions × 3 marks = 24 marks.** Numbered `1`–`8`; each is a single short question (no
  sub-parts), with a `CO` (course outcome) tag and the marks in a trailing column.
* **Part B: 4 modules × 9 marks = 36 marks.** Numbered `9`–`16` as **two questions per module** (9/10, 11/12,
  13/14, 15/16). Only one of the two is answered ("any one full question from each module").
* **Total = 24 + 36 = 60 marks**, matching the printed `Max. Marks: 60`.
* Part B questions are **sub-divided** with `a)`, `b)` (and sometimes `c)`), whose marks sum to 9
  (e.g. `a) … (5)  b) … (4)`; `a) … (2)  b) … (3)  c) … (4)`).
* **Module coverage rule as printed:** *"Answer any one full question from each module"* — i.e. the module
  labels, not a module-choice menu, define coverage. Each of the 4 modules is represented by exactly one
  answered question.
* The 2024-scheme modules are labelled **`Module 1` / `Module 2` / `Module 3` / `Module 4`** in the model
  papers and **`Module -1` / `Module -2` / `Module -3` / `Module -4`** in the real GAMAT101 papers
  (same content, different typography). PCCST303 shows `Module 4` and `M ule -2` `[OCR]`.
* In the extracted text of the 2024-scheme papers **no literal `OR` token appears between the paired
  questions**; the either/or choice is conveyed only by the Part B instruction. (Caveat: these are PDF text
  extractions, so a purely graphical `OR` rule could in principle be lost — but it is absent in all four
  2024-scheme papers read, including two separate courses and three sessions.)

### 2.2 2019 scheme — 100 marks, 3 hours, **two parts, 5 modules**

Verbatim instruction lines:

HUT300 (real paper, July 2023):

```
PART A
Answer all questions, each carries 3 marks.
```

```
PART B
Answer one question from each module, each carries 14 marks.
```

MAT 206 (2019-scheme model paper):

```
PART-A
(Answer All Questions. Each question carries 3 marks)
```

```
PART-B
(Answer any one question from each module. Each question carries 14 Marks)
```

* **Part A: 10 questions × 3 marks = 30 marks.**
* **Part B: 5 modules × 14 marks = 70 marks**, numbered `11`–`20`, again two questions per module.
* **Total = 30 + 70 = 100 marks**, matching `Max. Marks: 100`, `Duration: 3 Hours`.
* The literal token **`OR`** is printed between the two questions of each module pair, e.g. in HUT300:
  `11 a) … (10)  b) … (4)` … `OR` … `12 a) … (10)  b) … (4)`; MAT 206 shows `OR` between 11/12, 13/14,
  15/16, 17/18 and 19/20.
* Module labels use **Roman numerals**: `Module I`, `Module II`, … (HUT300 real paper).
* Part labels are hyphenated on the MAT 206 model paper (`PART-A`, `PART-B`) and unhyphenated on the
  HUT300 real paper and all 2024-scheme papers (`PART A`, `PART B`).
* Sub-parts on 2019 papers are usually `a)`/`b)` summing to **14** (e.g. MAT 206 `a) … (6)  b) … (8)`,
  `a) … (5)  b) … (9)`, `a) … (7)  b) … (7)`, `a) … (4)  b) … (10)`).

### 2.3 Marks arithmetic (self-check from the papers themselves)

| Item | 2024 scheme | 2019 scheme |
|---|---|---|
| Part A | 8 × 3 = **24** | 10 × 3 = **30** |
| Part B | 4 modules × 9 = **36** | 5 modules × 14 = **70** |
| Printed total | **60** (`Max. Marks: 60`) | **100** (`Max. Marks: 100`) |
| Printed duration | **2 hours 30 minutes** | **3 Hours** |
| Questions per paper | 16 (8 + 8) | 20 (10 + 10) |
| Answered per paper | 8 (all of Part A + 4 of Part B) | 15 (all of Part A + 5 of Part B) |

---

## 3. Layout quirks observed

**Module labels.** Four literal spellings occur in real material: `Module 1` … `Module 4` (2024 model papers),
`Module -1` … `Module -4` (2024 real papers), `Module 4` / `M ule -2` `[OCR]` (PCCST303 scan), and
`Module I` / `Module II` (2019-scheme HUT300). The module heading is a standalone line between Part B
questions — it is not a column.

**Sub-question numbering.** Two levels only: `9 a)`, `9 b)`, `9 c)`; a third level uses roman lower-case
inside the sub-question, e.g. UCEST105 Dec 2024 Q5 *"Write the output produced by the following code.
(i) … (ii) … (iii) …"* and MAT 206 Q13 *"i. Draw the graph G.  ii. How many edges must be added …"*.
GAMAT101 May 2025 Q12 a) lists four items inline (`∂²f/∂x²`, `∂²f/∂x∂y`, `∂²f/∂y∂x`, `∂²f/∂y²`) rather than
as sub-parts.

**Marks typography.** Marks sit in a **right-hand column on the same line as the question**, and the notation
differs per paper:
* `CO-1 (3)` and `CO1 (3)` — bracketed marks (UCEST105 real Dec 2024, GAMAT101 May 2025, all model papers).
* `CO1 3` and `CO4 3` — **bare, unbracketed** marks (GAMAT101 Dec 2024, PCCST303 `[OCR]`).
* 2019 scheme: `CO` column absent in MAT 206; HUT300 valuation scheme shows marks only in the *answer key*
  column (`(3)`, `(4)`, `(10)`), which is a valuation-scheme artifact, not the candidate paper.

**The `CO`/`Marks` column header.** On 2024-scheme papers the two column headings are printed immediately
after the Part A instruction, so text extraction renders them inline:
`(Answer all questions. Each question carries 3 marks) CO Marks`.

**Sub-part marks vs question marks.** Part B total marks are never printed on the question line; only the
sub-part marks appear (e.g. `a) … CO3 6  b) … CO3 3`). The 9-mark total must be summed.

**Tables.** Real papers embed tables inside questions:
* UCEST105 Dec 2024 model Q3: a 4-row `Flag value / Message` table (`1 Hot`, `2 Luke warm`, `3 Cold`,
  `Any other value Out of range`).
* UCEST105 model Q15 a): a 3-column `Recipe / Available quantity / Nutritional value` table
  (`Cooked rice 2.5 cups 800 calories`, `Sambar 1.5 cups 140 calories`, `Potato curry 0.5 cup 50 calories`),
  continued on the next page with three more rows, plus the note *"You may assume that 1 cup is equivalent
  to 250ml."*
* GAMAT101 May 2025 Q16 b): a `Machine / Product (A B C)` matrix (`M1 4 3 5`, `M2 2 2 4`).
Tables are extracted as running text, so their column structure is lost in a text-only transcription —
worth reproducing as a real Markdown table in a bundled sample paper.

**Figures.** Graph/flowchart questions reference figures that are images in the PDF and do **not** appear in
the text layer at all: e.g. MAT 206 Q6, Q8, Q12 a), Q15 b), Q18 a), Q20 b) all reference a graph
("for the following graph", "the graph G below", "the following weighted graph"), and UCEST105 asks for
flowcharts to be *drawn*. A faithful transcription must insert a placeholder such as
`[FIGURE: ...]` at those points.

**Page breaks and continuation.** Part B questions split across pages; the paper's own page counter is the
only page break marker. Model-paper PDFs from aggregators are prefixed by 1–2 promotional cover pages
(`KTUNOTES.LIVE`, `WWW.KTUSPECIAL.IN` watermarks) that are **not** part of the question paper.

**End of paper.** Model papers end with `*****`; the HUT300 valuation scheme ends sections with answer-key
text. No "END OF PAPER" wording was observed.

---

## 4. 2024 scheme vs 2019 scheme — differences actually observed

| Dimension | 2019 scheme | 2024 scheme |
|---|---|---|
| Printed total marks | `Max. Marks: 100` | `Max. Marks: 60` |
| Duration | `Duration: 3 Hours` | `Duration: 2 hours 30 minutes` |
| Part A | 10 questions × 3 marks (30) | 8 questions × 3 marks (24) |
| Part B | 5 modules × **14** marks (70) | 4 modules × **9** marks (36) |
| Modules per paper | 5 | 4 |
| Module labels | `Module I`, `Module II` … (Roman) | `Module 1`/`Module -1` … (Arabic, sometimes hyphenated) |
| Part B question total | numbered 11–20 | numbered 9–16 |
| `OR` separator | Printed literally between paired questions | Not present in extracted text; choice stated in the Part B instruction only |
| Part A instruction style | `Answer all questions, each carries 3 marks.` (real paper) / `(Answer All Questions. Each question carries 3 marks)` (model) | `(Answer all questions. Each question carries 3 marks)` — always parenthesised in the papers read |
| Part B instruction style | `Answer one question from each module, each carries 14 marks.` / `(Answer any one question from each module. Each question carries 14 Marks)` | `(Answer any one full question from each module, each question carries 9 marks)` — note "full question" |
| Scheme tag in header | none | `(2024 Scheme)` printed in the exam line |
| Course outcomes | not printed in Part A of the MAT 206 model paper | `CO`/`CO-1`…`CO-4` tag on every question |
| Sub-part sums to | 14 | 9 |
| Credit-side context | (not verified from regulations here) | CIE : ESE = 2 : 3 for theory courses (official regulations, §5) |

**Not asserted:** no 2024-scheme paper with 100 marks / 3 hours was found for a theory course, and no
2024-scheme S1/S2 paper other than the 60-mark/2.5-hour format was found. The 60-mark format was observed at
S1 (Dec 2024, May 2025) and S3 (Nov 2025), i.e. it is consistent across the semesters sampled.

---

## 5. What the official KTU 2024 regulations say (marks/assessment context)

From *APJ Abdul Kalam Technological University — Bachelor of Technology (Regular) Academic Regulations, 2024*
(mirror: `me.cet.ac.in`, 72 pages):

```
R 7.3 Candidates in each semester shall be evaluated both by Continuous Internal Evaluation (CIE)
and End Semester Examinations (ESE). Unless specifically mentioned in the curriculum, the ratio of
Continuous Internal Evaluation (CIE) to End Semester Examinations (ESE) shall be as follows:
1. Theory Courses - 2: 3
2. PBL Courses - 3: 2
3. HMC Courses - 1: 1
4. Laboratory Courses - 1: 1
5. Project - CIE only
6. Internship -CIE only
7. Seminar - CIE only
```

```
R 7.1 ... (m) 'ESE' means the End Semester Examination which is conducted by the University/
affiliated college at the End of the Semester for all the courses of that semester as per the
curriculum of study for the B-Tech programme;
```

```
• The duration of the written examination shall be 2 hours and it shall carry a total of 40 marks.
```

The last line is about the **internal** written examination (R 7.5 i), **not** the ESE — do not confuse it with
the ESE duration. The ESE duration and ESE marks are fixed per course in the syllabus/curriculum
(R 3.10: a syllabus "specifies … Continuous Internal Evaluation (CIE) Marks, End Semester Examination (ESE)
Marks, exam duration … and question paper format"). A 2 : 3 CIE : ESE split on a 100-mark course gives
CIE 40 + ESE 60 — consistent with the 60-mark ESE papers printed above. The regulations themselves never
print "Part A / Part B", "8 questions" or "9 marks"; those are properties of the question paper format
published with each syllabus and evidenced by the papers in §7.

---

## 6. Sources (all URLs used)

**2024-scheme real end-semester papers**
* UCEST105 (S1, Dec 2024 regular) — https://www.scribd.com/document/953356125/Ucest105-Algorithmic-Thinking-With-Python-Dec-2024-Solved
  (read via https://r.jina.ai/https://www.scribd.com/document/953356125/Ucest105-Algorithmic-Thinking-With-Python-Dec-2024-Solved)
* GAMAT101 (S1, Dec 2024 regular) — https://ktuspecial.in/ktu-gamat101-mathematics-for-information-science1-question-papers-2024-scheme-s1-geoup-a/
  linking the paper PDF https://drive.google.com/file/d/1mfmBZ29HxkqoplA6UcOUQM9k_X5VXdnC/view
* GAMAT101 (S1, May 2025 supplementary) — same aggregator page, PDF https://drive.google.com/file/d/175hHcY09GfunSg9XEh7kxVSrhnkztgSb/view
* PCCST303 (S3, Nov 2025, R/FT/WP) — https://ktunotes.in/pccst303-question-papers-ktu-2024-scheme-data-structures-and-algorithms/
  linking https://drive.google.com/file/d/1l-v9zWeoqPcjYWka7rA_l2ciaGbAzTwa/view

**2024-scheme KTU model question papers**
* UCEST105 model paper — https://drive.google.com/file/d/1FyU8sM2j6yvO9qInZyOerUt17QCKhzZK/view (via https://model.ktunotes.live/s1/a/ucest105)
  and https://www.scribd.com/document/790223089/UCEST105-Algorithmic-thinking-with-Python-MODEL-QP-SEMESTER-1
* GAMAT101 model paper — https://drive.google.com/file/d/1H0g0MgYYVr8V1mhENImK--8JZlisGD1D/view (via https://model.ktunotes.live/GAMAT101)
* GAMAT101 / GAPHT121 model pages in the S1 Group A set — https://www.scribd.com/document/783897872/s1-Group-A-model-Qp-b-Tech-2024-Scheme-1
* S2 model paper set (same publisher) — https://model.ktunotes.live/s2

**2019-scheme papers**
* HUT300 (S6, July 2023) valuation scheme reproducing the paper header — https://www.scribd.com/document/876879271/Hut300-June-2023-As
* MAT 206 Graph Theory (S4) 2019-scheme model paper — https://www.keralanotes.com/p/ktu-graph-theory-2019-model-question.html

**Official regulations**
* B.Tech (Regular) Academic Regulations, 2024 — http://me.cet.ac.in/downloads/26-09-2025/B.Tech%20Academic%20Regulations%20KTU%202024%20Scheme.pdf
  (identical copies: https://nssce.ac.in/pdf/B.TechRegulation_2024.pdf,
  https://sngce.ac.in/user/files/B_%20Tech%20Regulations_%202024(1).pdf,
  http://www.mahagurutech.ac.in/images/EventsNewFrom2024/WholeMIT/KTURegulations/BTechRegulations2024.pdf)

**Rejected as non-authoritative**
* https://www.scribd.com/document/954215754/UCHUT346-Model-Question-Paper — a one-page upload titled
  "KTU MODEL QUESTION PAPER – UCHUT346 Economics for Engineers (2024 Scheme)" showing a three-part paper
  (`PART A – Short Answer Questions (10 × 3 = 30 Marks)`, `PART B – Short Essay Questions (5 × 6 = 30 Marks)`,
  `PART C – Long Essay Questions (4 × 10 = 40 Marks)`) at `Max Marks: 100` / `Time: 2 Hours 30 Minutes`.
  That structure matches **no** KTU-published paper or model paper found (no modules, no `CO` column, three
  parts, marks that do not match the KTU model set), so it is excluded from every claim above.
* Index/aggregator pages that only list PDF links (ktunotes.in, model.ktunotes.live, ktu.notesundo.in,
  btechtutor.com) were used only to reach papers, never as evidence of structure.
