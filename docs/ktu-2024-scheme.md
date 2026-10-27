# KTU 2024-scheme B.Tech syllabus — parser reference

**Scope.** APJ Abdul Kalam Technological University (KTU), Kerala. **B.Tech (Regular) 2024 scheme / Regulations 2024**, in force from academic year 2024–25.

**Provenance.** Every fact below is tied to a URL. Official KTU documents were obtained as PDFs and read through a text extractor (`https://r.jina.ai/<url>`) because PDFs cannot be fetched as text directly and `ktu.edu.in` serves its Academics area as a client-rendered SPA. Per-course syllabus PDFs came from a third-party mirror (noted as such in §6). Nothing here is invented; where I could not verify something I say so explicitly.

> **Read this first if you are building the parser.** Two assumptions in the task brief turned out to be **wrong for real 2024 documents**, and the parser must not encode them:
> 1. Course codes are **not** `24XXX###`. Real 2024 codes look like `GAMAT101`, `UCEST105`, `PCCST303`, `PCECT302`, `UCHUT346` — an 8-character alphanumeric form with no `24` prefix anywhere. See §4.
> 2. The credit block is **not** `L-T-P-C`. The syllabus header prints **`Teaching Hours/Week (L: T:P: R)`** and a *separate single* `Credits` value. The tuple is **L‑T‑P‑R** (R = Project hours); there is no per-course C in the tuple. See §5.

---

## 1. Regulation basics

### 1.1 Identity and commencement

| Item | Value | Source |
|---|---|---|
| Full title | "The A P J Abdul Kalam Technological University Bachelor of Technology (Regular) Academic Regulations, 2024" | Regulations 2024, Preamble/short title |
| In force from | academic year **2024–2025** | Regulations 2024, R 2 (Commencement) |
| Applies to | students admitted to **colleges affiliated to KTU other than autonomous colleges**, from AY 2024–25 | Regulations 2024, R 3 (Application) |
| Duration | **4 years / 8 semesters** | Regulations 2024, R 3.1 |

Official regulations PDF (college mirror, 72 pages): `http://me.cet.ac.in/downloads/26-09-2025/B.Tech%20Academic%20Regulations%20KTU%202024%20Scheme.pdf`
Also mirrored at `https://nssce.ac.in/pdf/B.TechRegulation_2024.pdf`, `https://sngce.ac.in/user/files/B_%20Tech%20Regulations_%202024(1).pdf`, `http://www.mahagurutech.ac.in/images/EventsNewFrom2024/WholeMIT/KTURegulations/BTechRegulations2024.pdf`.

### 1.2 Total credits and degree variants

| Programme option | Total credits | Breakdown | Source |
|---|---|---|---|
| "B. Tech." (Engineering Major discipline) | **170** | 167 academic + 3 from student activities | R 3.2, R 3.12 |
| "B. Tech. with Minor" | 185 | 170 + 15 Minor coursework | R 3.2 |
| "B. Tech. with Honours" | 185 | 170 + 15 Honours coursework | R 3.2 |
| "B. Tech. with Honours and Minor" | 200 | 170 + 15 + 15 | R 3.2 |

**Credit relaxation (R 3.3).** A student who acquires at least **160 credits** (157 academic + 3 activity) after the normal 8 semesters is still eligible for the degree — i.e. a shortfall of up to 10 credits is tolerated. **Seminar, Mini Project and Project/Internship are excluded** from this relaxation and are mandatory. Minor credits do **not** count toward the 160.

**Degree eligibility (R 11.1):** minimum **CGPA 5.0** **and** minimum 160 credits including the 3 activity credits.

### 1.3 Credit accounting rules (R 3.12, R 3.13)

* 1 hour Lecture (L)/week = 1 credit
* 1 hour Tutorial (T)/week = 1 credit
* 2 hours Practical (P)/Project (R)/week = 1 credit
* 3–4 hours Seminar (S)/Practical (P)/Project (R)/week = 2 credits
* 1 Project Hour (R) in a PBL course/week = 1 credit

**Self-Study hours (R 3.14 / curriculum):** `SS Hours = 1.5 L + 0.5 T + 0.5 P + R` per week. This appears as an `SS Hrs./Week` column in the curriculum tables — a **fourth** numeric column alongside L, T, P, R. A parser that assumes exactly four numbers in the credit area will break here; the curriculum table actually prints `L T P R SS CIA ESE Credits`.

**CIE : ESE ratio (R 7.3)** — this is the authoritative split rule:

| Course kind | CIE : ESE |
|---|---|
| Theory Courses | **2 : 3** (→ 40 : 60) |
| PBL Courses | **3 : 2** (→ 60 : 40) |
| HMC Courses | **1 : 1** (→ 50 : 50) |
| Laboratory Courses | **1 : 1** (→ 50 : 50) |
| Project | CIE only |
| Internship | CIE only |
| Seminar | CIE only |

Internal written examinations (R 7.5): duration **2 hours**, total **40 marks**; when two are held each covers 50% of the syllabus.

Attendance CIE bands (R 7.5 ii): full marks at **≥85%**; 4 marks for >80–85%; 3 for >75–80%; 2 for >70–75%; 1 for >60–70%; 0 below 60%.

### 1.4 Semester structure and credit distribution

The **official regulation's own scheme-migration table (R 14.5)** gives the per-semester credit totals, which double as the cleanest evidence of the 2019→2024 credit change:

| Semester | 2019 scheme credits | 2024 scheme credits |
|---|---|---|
| S1 | 17 | 20 |
| S2 | 21 | 24 |
| S3 | 22 | 25 |
| S4 | 22 | 24 |
| S5 | 23 | 23 |
| S6 | 23 | 23 |
| S7 | 15 | 17 |
| S8 | 17 | 11 |
| **Total** | **160** | **167 academic** (+3 activity = **170**) |

Note the shape change: 2024 front-loads S1–S4 and **shrinks S8 to 11 credits** (electives + HMC + Major Project only). Academic year = **Odd + Even + Summer semester**; each semester ≥ **90 working days**, of which **65 instructional** (R 3.5).

Course category credit table (R 3.15): HMC 9, BSC 20, ESC 29, PCC 52, PBL 16, PEC 18, OEC/ILE 9, PWS 12, HWP 1, SEC 1 = **167**; MSA 3 → **170**.

### 1.5 Levels

The regulation defines **only two levels** (R 3.19–R 3.25), and they apply **only inside the Programme Electives category**:

| Level | Bloom's focus | Credits | Delivery | Assessment |
|---|---|---|---|---|
| **Level 3** | lower three: Remember, Understand, Apply | **3** | 3 h classroom/week | same as standard theory |
| **Level 5** | higher-order: **Analyze, Evaluate** *plus* lower levels | **5** = 3 PE credits + 2 additional | 3 h classroom/week **+ 3 h/week self-study** | lower three levels via CIE **and** ESE; higher levels via **CIE only** |

Level 5 CIE distribution (R 3.21): Attendance **5** + Internal Examination **15** + Assessment of Bloom's Taxonomy Levels (**Analyze 5**, **Evaluate 5**) + **Viva 10** — and the viva is conducted by an **external subject expert from another KTU-affiliated college**, in the last week of the semester. Only **one** internal examination is held for a Level 5 course. The 2 bonus credits are awarded only if the student scores **≥80%** of CIE marks *or* **≥70%** in the viva alone, **and** secures at least grade **'B'** on combined CIE+ESE; otherwise only 3 credits are awarded (R 3.24).

> **Do not invent a "Foundation" level or a "Level 4".** I searched the official regulation text for `Foundation` and `Level 4` as course-level labels and found **neither**. The `Foundation` string only appears in generic prose ("foundational courses in Humanities, Skilling, and Computer Science" for University Core, R 3.39). If a document you are parsing says "Foundation", it is a course *title* substring (e.g. "Foundations of Computing: From Hardware Essentials to Web Design", `GXEST203`), not a level.

In the real CSE curriculum, Level 5 electives are visibly marked and their credit is ambiguous in the source — e.g. `PECST415 VLSI Design Level 5` printed as `**3** or 5 (Level 5)`, versus `PECST495 Advanced Data Structures Level 5`. A parser must accept both "3" and "3 or 5" in the credits cell for these rows.

### 1.6 What changed vs the 2019 scheme

**Officially verified:**

* **160 → 170 credits** (167 academic + 3 activity). Directly derivable from R 14.5 whose 2019 column sums to 160 and 2024 column to 167.
* A brand-new regulation that **replaces** the 2019 scheme for new admissions; KTU runs a formal **scheme-migration / transitory-course** process in which the Board of Studies maps 2019 courses to 2024 equivalents (R 14.1–R 14.9).
* **New categories and mechanisms:** Level 3 / Level 5 multilevel electives, **Industry Linked Electives (ILE)** and **Industry Linked Minors (ILM)** designed with industry partners (R 3.21 area, R 15.2), **Minor registration at the beginning of the third semester** (R 15.3), Open Elective registration barred where syllabus overlap with the Major/Honours/Minor exceeds **30%** (R 3.27).
* **New common courses visible in the official curriculum:** `UCEST105 Algorithmic Thinking with Python`, `GXEST203 Foundations of Computing: From Hardware Essentials to Web Design`, `UCEST206 Engineering Entrepreneurship & IPR`, `UCHWT127 Health and Wellness`, `UCHUT128 Life Skills and Professional Communication`, `UCSEM129 Skill Enhancement Course: Digital 101 (NASSCOM) MOOC`, `GAEST305 Digital Electronics & Logic Design`.
* **Summer semester** formalised as part of the academic year (R 3.5).

**Claimed by non-official sites — NOT verified, do not rely on it:**

* `btechtutor.com` states "Python replacing C programming in S1". The official 2024 curriculum lists **both**: `UCEST105 Algorithmic Thinking with Python` (S1) **and** `GXEST204 Programming in C` (S2). So "replaced" is inaccurate.
* The same page claims Honours/Minor "from S5". Official R 15.3 says Minor registration is permitted **at the beginning of the third semester**.
* I did **not** verify the 2019-scheme course-code format in this research, so I make no claim about how 2019 codes differ textually from 2024 codes.

### 1.7 Grouping (official curriculum)

Four groups; a branch's group determines its Mathematics/Physics/Chemistry and Engineering-Science courses:

* **Group A** — Computer and Information Science (CSE, AI, AI&ML, AI&DS, CS&BS, Cyber Security, IT, CSE(DS), CSE(IoT), …)
* **Group B** — Electrical Science (ECE, EEE, Electronics & Biomedical, Biomedical, E&I, Instrumentation & Control, Cyber Physical Systems, VLSI Design & Technology, Robotics & AI, …)
* **Group C** — Physical Science (Civil, Chemical, Mechanical, Mechatronics, Production, Aeronautical, Agriculture, Industrial, Metallurgical & Materials, Naval Architecture, Polymer, Safety & Fire, …)
* **Group D** — Life Science (Biotechnology, Food Technology, Biotechnology & Biochemical Engineering)

---

## 2. Course codes: real format

**Format observed:** `[G|U|P|M|O][group-or-scope letter][3-letter area code][delivery letter][3 digits]`

Real codes **verified in official documents** (not reconstructed):

| Code | Subject area | Delivery / kind | Semester digit |
|---|---|---|---|
| `GAMAT101` | MAT = Mathematics, GA = Group A | T = Theory | 1 |
| `GYMAT201` | MAT, GY = Group B | T | 2 |
| `GAPHT121` | PHT = Physics, Group A | T | 1 |
| `GBPHT121` | PHT, Group B | T | 1 |
| `GXCYT122` | CYT = Chemistry, GX = cross-group | T | 1 |
| `GMEST103` | EST = Engineering Science & Technology, Group A | T | 1 |
| `GXEST104` | EST, cross-group | T | 1 |
| `UCEST105` | EST, UC = University Core | T | 1 |
| `GXESL106` | EST, cross-group | **L = Lab** | 1 |
| `UCHWT127` | HWT = Health & Wellness | T | 1 |
| `UCHUT128` | HUT = Humanities | T | 1 |
| `UCSEM129` | SEM = Skill Enhancement MOOC | **M = MOOC** | 1 |
| `GXEST203` / `GXEST204` | EST | T | 2 |
| `PCXXT205` | XX = per-branch placeholder, PC = Programme Core | T | 2 |
| `UCEST206` | EST, University Core | T | 2 |
| `GAMAT301` / `GYMAT301` | MAT | T | 3 |
| `PCCST302` / `PCCST303` | CST = Computer Science & Technology, PC | T | 3 |
| `PCECT302` / `PCECT303` | ECT = Electronics & Communication Technology | T | 3 |
| `PBECT304` / `PBCST304` | PB = PC-Project Based Learning | T | 3 |
| `GAEST305` / `GNEST305` | EST | T | 3 |
| `PCCSL307` / `PCCSL308` | CST | **L** | 3 |
| `UCHUT346` / `UCHUT347` | HUT | T | 3 |
| `GAMAT401` | MAT | T | 4 |
| `PECST411`…`PECST419` | CST, PE = Programme Elective | T | 4 |
| `PECST495` | Level 5 elective | T | 4 |
| `UCHUM506` | HUT, **M = MOOC** | M | 5 |
| `PCXXS705` | **S = Seminar** | S | 7 |
| `PCXXP706` / `PCXXI706` | **P = Project / I = Internship** | P/I | 7 |
| `UEHUT704` / `UEHUM70N` | UE = University Elective | T | 7 |
| `PCCSP608` | CSP = Mini Project | P | 6 |
| `UEHUT803` / `UEHUM803` | UE | T | 8 |
| `PCXXP806` | Project | P | 8 |

**Rules a parser can rely on:**

1. **Positions 1–2 = scope + group/level.** `GA/GB/GC/GD` = Group A/B/C/D; `GX` = offered to more than one group; `GY`/`GZ` = Group B / Group C variants; `UC` = University Core; `UE` = University Elective; `PC` = Programme Core; `PB` = Programme Core–PBL; `PE` = Programme Elective; `OE` = Open Elective; `IE` = Industry-linked Elective; `MN` = Minor (e.g. `MNCPT309`, `MNECT309`, `MNRAT309`).
2. **Positions 3–5 = subject area**: `MAT`, `PHT`, `CYT`, `EST`, `HWT`, `HUT`, `CST`, `ECT`, `CEM`, `SEM`, … `XX` is an explicit **wildcard placeholder** used in the curriculum for not-yet-fixed Programme Core slots (`PCXXT205`, `PCXXT302`).
3. **Position 6 = delivery/kind**: `T` Theory, `L` Lab, `S` Seminar, `P` Project, `M` MOOC, `I` Internship.
4. **Last 3 digits**: first digit = **semester**; final two = university-wide serial. A trailing **`N`** is a literal placeholder for an elective slot number (`PEXXT41N`, `OEXXT61N`, `UEHUM70N`) — it is not a digit, so `\d{3}` will not match those codes.
5. Codes are **not** zero-padded with a scheme/year prefix. There is no `24` anywhere.

**Naming conventions in titles.** Title is printed **ALL CAPS** in the syllabus heading; the curriculum table uses Title Case. Group/audience qualifiers appear as a parenthetical on the line after the title:

* `SEMESTER S1 MATHEMATICS FOR INFORMATION SCIENCE – 1 (Group A)`
* `SEMESTER S3 DATA STRUCTURES AND ALGORITHMS (Common to CS/CA/CM/CD/CR/AI/AM/AD/CB/CN/CC/CU/CI/CG)`
* `SEMESTER S3/S4 ECONOMICS FOR ENGINEERS` (no qualifier)

**Slot letters.** The curriculum assigns courses to slots `A B C D E F G I L O P Q S` and `R/M/H` (Remedial / Minor / Honours). Slot letters are reused across semesters with different meanings.

---

## 3. Real, literal structure of a KTU 2024-scheme syllabus document

Observed identically across six real 2024-scheme syllabus PDFs (`UCEST105`, `GAMAT101`, `PCCST302`, `PCCST303`, `PCECT302`, `UCHUT346`). Headings appear in this order:

1. **Running header** (every page): `B.Tech 2024 –S1/S2` (or `–S3`) · `APJ Abdul Kalam Technological University` · page number
2. **Section heading**: `SEMESTER S1  <COURSE TITLE IN CAPS>` and, on the next line, the audience qualifier — `(Group A)` or `(Common to CS/CA/CM/CD/…)`. *Some documents omit the qualifier entirely (`PCECT302`).*
3. **Course identity block** — a 2-column, 4-row table. This is the part parsers get wrong; the *order of the rows is fixed* but the left/right split is **not** consistent between documents:

   | Left cell | Right cell |
   |---|---|
   | `Course Code  <CODE>` | `CIE Marks  40` |
   | `Teaching Hours/Week (L: T:P: R)  3:0:2:0` | `ESE Marks  60` |
   | `Credits  4` | `Exam Hours  2 Hrs. 30 Min` |
   | `Prerequisites (if any)  None` | `Course Type  Theory` |

   Note: `Teaching Hours/Week` is written **`(L: T:P: R)`** — colon after L, colon after T, **no space** before P, space after `P:`. `UCEST105` and `PCECT302` print `3:1:0:0`; `PCCST302` wraps the label onto two lines (`Teaching Hours/Week (L: T:P: R)` newline `3:1:0:0`). `Prerequisites` values range over `None`, a course code (`UCEST105`, `PCCST205`), or prose (`Basic knowledge in single variable calculus`).

   **There is no "Preamble" heading in a per-course syllabus.** The word *Preamble* belongs to the **Academic Regulations** document, not to course syllabi. Per-course, the corresponding element is **`Course Objectives:`** — a numbered list (1., 2., 3.).

4. **`SYLLABUS`** — a 3-column table with headers exactly: `Module No.` | `Syllabus Description` | `Contact Hours`. **Always 4 modules** for these theory courses. Each module is **one dense paragraph** in the `Syllabus Description` cell; topics are separated by **semicolons** and by **CAPITALISED lead-ins ending in `:-`**, e.g. `SELECTION AND ITERATION USING PYTHON:-`. Sub-items inside the prose are comma-separated (`list, tuple, set, strings, dictionary`) or hyphen-prefixed dash bullets. Footnote markers `*` and `**` are used inside cells and explained at the end of the cell.
   A fourth, **indented** line often appears inside the cell in square brackets, e.g. `[Relevant topics from: Text 1- sections 2.2, 2.5, 3.1, …]` — a pointer into the Text Books table.
5. **`Course Assessment Method (CIE: 40 marks, ESE: 60 marks)`** — parenthetical values change by course type (`(CIE: 50 marks, ESE: 50 marks)` for HMC).
   * **`Continuous Internal Evaluation Marks (CIE):`** — table with columns: `Attendance` | `Assignment/ Microproject` | `Internal Examination-1 (Written)` | `Internal Examination-2 (Written)` | `Total`. `UCEST105` replaces the second column with `Continuous Assessment (Accurate Execution of Programming Tasks)` and adds `Internal Examination- 3 (Lab Examination)`; `UCHUT346` uses `Assignment/Case Study/ Microproject` and half-marks `12.5`.
   * **`End Semester Examination Marks (ESE)`** — preceded verbatim by the sentence: *"In Part A, all questions need to be answered and in Part B, each student can choose any one full question out of two questions"*, then a table `Part A` | `Part B` | `Total`.
6. **`Course Outcomes (COs)`** — led by the fixed line **`At the end of the course students should be able to:`**.
   **Exact column headers — only TWO columns:**
   `Course Outcome` | `Bloom's Knowledge Level (KL)`
   The CO identifier (`CO1`, `CO2`, …) is **inside the first column**, concatenated with the statement text — there is **no separate "CO" column**. Counts vary: 4 COs (`UCEST105`, `GAMAT101`, `PCCST303`, `UCHUT346`) or 5 (`PCCST302`, `PCECT302`).
7. **`Note : K1- Remember, K2- Understand, K3- Apply, K4- Analyse, K5- Evaluate, K6- Create`** — directly under the CO table. **Spelling varies:** `Analyse` (British, most documents) vs `Analyze` (`GAMAT101`). The **same document** can use both spellings in different places.
8. **`CO-PO Mapping Table:`** (caption varies — `PCCST302`/`PCECT302` add `(Mapping of Course Outcomes to Program Outcomes)`; `PCECT302` has the typo `(Mapping od Course Outcomes to Program Outcomes)`). Columns `PO1 … PO12`; cells are `1`/`2`/`3` or `-`. Followed by `Note: 1: Slight (Low), 2: Moderate (Medium), 3: Substantial (High), -: No Correlation`.
   **Column-position caveat:** in `GAMAT101` the CO labels are rendered **after** the PO cells on the same row (`CO1 3 3 - 2 …` appears as `3 3 - 2 …` then `CO1`), and in `PCCST303` the whole table is emitted **after** the Text Books/Reference Books tables. Row-label position is not stable.
9. **`Text Books`** — columns: `Sl. No` | `Title of the Book` | `Name of the Author/s` | `Name of the Publisher` | `Edition and Year`.
10. **`Reference Books`** — **same 5 columns** (some documents print only `Sl. No`, `Title of the Book`, etc. with the header split across lines).
11. **`Video Links (NPTEL, SWAYAM...)`** — columns: `Module No.` | `Link ID` (sometimes `Module No. | Link ID`, with two URLs in one cell).
12. **Course-specific extras (present in some, absent in others):**
    * A complete **`MODEL QUESTION PAPER`** appended *inside* the syllabus PDF (`UCHUT346`).
    * `1. Continuous Assessment (5 Marks)` / `2. Evaluation Pattern for Lab Examination (10 Marks)` breakdowns, `Sample Classroom Exercises:`, `LAB Experiments:`, `Rules:` (`UCEST105`).
    * `CO-PO Mapping Table` may be empty (the CO-PO table in `UCHUT346` has no rows before the Text Books header).

### 3.1 Verbatim excerpt (real 2024-scheme syllabus, `UCEST105`)

Reproduced exactly as extracted from the PDF text layer at `https://ktu.notesundo.in/api/download/pmh2Mu24` (page 32–36). Only whitespace/line-wrapping is normalised.

```
# SEMESTER S1 ALGORITHMIC THINKING WITH PYTHON (Common to All Branches)

Course Code UCEST105                      CIE Marks 40
Teaching Hours/Week(L: T:P: R) 3:0:2:0    ESE Marks 60
Credits 4                                 Exam Hours 2 Hrs. 30 Min
Prerequisites (if any) None               Course Type Theory

Course Objectives:
1. To provide students with a thorough understanding of algorithmic thinking and its practical applications in solving real-world problems.
2. To explore various algorithmic paradigms, including brute force, divide-and-conquer, dynamic programming, and heuristics, in addressing and solving complex problems.

# SYLLABUS

Module No. | Syllabus Description | Contact Hours
1 | PROBLEM-SOLVING STRATEGIES:- Problem-solving strategies defined, Importance of understanding multiple problem-solving strategies, Trial and Error, Heuristics, Means-Ends Analysis, and Backtracking (Working backward). THE PROBLEM-SOLVING PROCESS:- Computer as a model of computation, Understanding the problem, Formulating a model, Developing an algorithm, Writing the program, Testing the program, and Evaluating the solution. ESSENTIALS OF PYTHON PROGRAMMING:- Creating and using variables in Python, Numeric and String data types in Python, Using the math module, Using the Python Standard Library for handling basic I/O - print, input, Python operators and their precedence. | 7

Course Assessment Method (CIE: 40 marks, ESE: 60 marks)
Continuous Internal Evaluation Marks (CIE):
Attendance | Continuous Assessment (Accurate Execution of Programming Tasks) | Internal Examination-1 (Written Examination) | Internal Examination-2 (Written Examination) | Internal Examination- 3 (Lab Examination) | Total
5 | 5 | 10 | 10 | 10 | 40

End Semester Examination Marks (ESE)
In Part A, all questions need to be answered and in Part B, each student can choose any one full question out of two questions
Part A | Part B | Total
- 2 Questions from each module.                    | - Each question carries 9 marks.
- Total of 8 Questions, each carrying 3 marks     | - Two questions will be given from each module, out of which 1 question should be answered.
  (8x3 =24marks)                                  | - Each question can have a maximum of 3 sub divisions.
                                                  |   (4x9 = 36 marks)
                                                  | 60

Course Outcomes (COs)
At the end of the course students should be able to:
Course Outcome                                                          | Bloom's Knowledge Level (KL)
CO1 Utilize computing as a model for solving real-world problems.       | K2
CO2 Articulate a problem before attempting to solve it and prepare a
    clear and accurate model to represent the problem.                   | K3
CO3 Utilize effective algorithms to solve the formulated models and
    translate algorithms into executable programs.                       | K3
CO4 Interpret the problem-solving strategies, a systematic approach to
    solving computational problems, and essential Python programming
    skills                                                              | K3

Note : K1- Remember, K2- Understand, K3- Apply, K4- Analyse, K5- Evaluate, K6- Create
```

Reference Books table header, verbatim from the same document:

```
Reference Books
Sl. No | Title of the Book | Name of the Author/s | Name of the Publisher | Edition and Year
1 | Problem solving & programming concepts | Maureen Sprankle, Jim Hubbard | Pearson | 9/e, 2011
2 | How to Solve It: A New Aspect of Mathematical Method | George Pólya | Princeton University Press | 2/e, 2015
```

---

## 4. Exam / question paper pattern

**There is no standalone official KTU document titled "Question Paper Pattern" that I could find.** The pattern is instead printed **inside every course syllabus**, in the `End Semester Examination Marks (ESE)` block, and is separately confirmed by real KTU model question papers. I state this explicitly because the brief asked me to.

### 4.1 Verbatim, from real 2024-scheme syllabus PDFs (theory courses, 60-mark pattern)

Identical wording in `UCEST105`, `GAMAT101`, `PCCST302`, `PCCST303`, `PCECT302`:

> `In Part A, all questions need to be answered and in Part B, each student can choose any one full question out of two questions`
>
> **Part A** — "2 Questions from each module." / "Total of 8 Questions, each carrying 3 marks (8x3 =24marks)"
>
> **Part B** — "Each question carries 9 marks." / "Two questions will be given from each module, out of which 1 question should be answered." / "Each question can have a maximum of 3 sub divisions. (4x9 = 36 marks)"
>
> **Total 60**

Source: `https://ktu.notesundo.in/api/download/pmh2Mu24` (UCEST105), and identically in `.../VEcvDnF1`, `.../bBig57Ev`, `.../MqcvzosU`, `.../BCq1DLg7`.

### 4.2 Summary table

| | Standard theory (60-mark pattern) | HMC theory (`UCHUT346`) |
|---|---|---|
| ESE duration | **2 hours 30 minutes** | **2 hours 30 minutes** |
| ESE max marks | **60** | **50** |
| CIE marks | 40 | 50 |
| Part A | **8 compulsory** questions × **3** = **24** | **6** compulsory questions × **3** = **18** |
| Part A module coverage | exactly **2 per module** | "Minimum 1 and Maximum 2 Questions from each module" |
| Part B | **4** questions × **9** marks = **36** | **4** questions × **8** marks = **32** |
| Part B choice | **two per module, answer ONE** (either/or) | **two per module, answer ONE** (either/or) |
| Part B sub-divisions | max **3** | max **2** |
| Modules | 4 | 4 |

**Either/or choices: yes — but only in Part B**, and the choice is *per module* ("answer any one full question from each module"), not a global either/or across the whole paper. Part A has no choice.

`Exam Hours 2 Hrs. 30 Min.` is printed in the header block of every syllabus observed. **The Academic Regulations 2024 do not fix an ESE duration** — they only fix the 2-hour internal written exam (R 7.5). So the ESE duration is a per-syllabus declaration, and a parser should read it from the header, not assume it.

### 4.3 Confirmed against a real 2024-scheme model question paper, verbatim

`GAMAT101`, model paper hosted on Google Drive and linked from `https://model.ktunotes.live/s1/a/gamat101`:

```
MODEL QUESTION PAPER
APJ ABDUL KALAM TECHNOLOGICAL UNIVERSITY
FIRST SEMESTER B. TECH DEGREE EXAMINATION, DEC 2024

Course Code: GAMAT101
Course Name: MATHEMATICS FOR INFORMATION SCIENCE-1
Max. Marks: 60                    Duration: 2 hours 30 minutes

PART A
Answer all questions. Each question carries 3 marks          CO      Marks
1 Evaluate lim x→3 ( (√x+1 − 2) / (x − 3) ) .                CO1     (3)
2 At what points are the following functions y = |x − 1| + sin x continuous?   CO1  (3)
3 Find and sketch the level curve of the function f(x, y) = x² + y² passing through the point (2,0).  CO2  (3)
4 Find the values of ∂f/∂x and ∂f/∂y at the point (4, -5) if f(x, y)=x²+3xy+y-1.  CO2  (3)
5 Find the directional derivative of f(x, y) = xy at the point (1, 2) in the direction of the vector u = √3i + j.  CO3  (3)
6 Find the local extreme values of f(x, y) = y² - x²          CO3     (3)
7 Explain the method of steepest descent.                     CO4     (3)
8 Maximize f= 5x1+25 x2 subject to the constraints x1-3x2≥ −6, x1+ x2≤6, x1,x2≥0   CO4  (3)

PART B
Answer any one full question from each module. Each question carries 9 marks
Module 1
9  a) Find the first and second derivatives of f(x) = ln (x + 1)   CO1  (2)
   b) Find the derivative of y = tan (5 − sin 2x)                  CO1  (3)
   c) Linearize f(x) = x² + 2x at x = 0.1                          CO1  (4)
10 a) Use Implicit differentiation to find dy/dx in x³ + y³ = 18xy  CO1  (2)
   b) Find the equations of the tangent and normal lines to the curve y = x² at point (1,1)  CO1  (3)
   c) Determine the concavity of f(x) = −2x³ + 6x² − 3             CO1  (4)
```

This confirms: **Part A = 8 questions, 2 per module, all compulsory, 3 marks**; **Part B = 2 questions per module (Q9/Q10 for Module 1), either/or, 9 marks, split into a)/b)/c) sub-divisions**; per-question **`CO` and `Marks` columns** in the paper itself; and the paper prints `Max. Marks: 60` with `Duration: 2 hours 30 minutes`.

The **HMC variant** is also confirmed by a real model paper embedded in the `UCHUT346` syllabus PDF: `Max. Marks: 50  Duration: 2 hours 30 minutes`, Part A "Answer all questions. Each question carries 3 marks" with questions numbered 1–6 (2 marks each = 18), Part B "Answer any one full question from each module. Each question carries 8 marks" with `a) … (5) b) … (3)` sub-divisions.

A parallel, independent analysis of real end-semester KTU papers (including actual Dec 2024 `UCEST105` and `GAMAT101` papers) is already in this repo at `docs/ktu-paper-structure.md`.

---

## 5. Layout tolerance: the variations that will break a naive parser

Concrete inconsistencies I actually observed across **official** KTU documents and the syllabus PDFs.

### 5.1 Two official documents disagree with each other

| Field | Academic Regulations 2024 (R 3.15) | B.Tech Curriculum 2024 | 
|---|---|---|
| Programme Core (PCC) credits | **52** | **54** |
| PWS (Mini Project/Project/Seminar) | **12** | **10** |
| Health & Wellness category code | **HWP** | **PW** |
| Total academic credits | 167 | 167 |

Both are official KTU documents and both total 167. **Do not hard-code either number.**

### 5.2 Course-code inconsistencies in official documents

* The curriculum's **Group C** table prints `GYMAT101` for "Mathematics for Physical Science-1". `GY` is the **Group B** prefix and `GZ` is Group C's (as used by `GZPHT121`, `GZEST203`, `GZESL208`). This is a copy-paste defect in the official PDF. Expect mis-prefixed codes.
* Wildcard `XX` codes (`PCXXT205`) and placeholder `N` codes (`PEXXT41N`) coexist with concrete codes in the same table.
* Semantically-parallel courses get different prefixes for no visible rule: `GXCYT122` (Chemistry, cross-group), `GCCYT122` (Group C, **GC** prefix), `GDCYT122` (Group D), and `GXCYT122` again used as "Chemistry for Electrical Science" in one place and "Chemistry for Information Science" elsewhere.

### 5.3 Title inconsistencies

* `GXCYT122` is titled **"Chemistry for Electrical Science"** on `ktunotes.in/ktu-s1-cse-syllabus-2024-scheme/` but **"Chemistry for Information Science"** on `ktu.notesundo.in` and in `ktunotes.in/curriculum/2024/cse/`, where the same code carries the title **"Chemistry for Information Science / Electrical Science"**.
* `GXEST104` appears as "Introduction to Electrical & Electronics Engineering" (curriculum index) and "Introduction to Electrical & Electronics Engineering (Part 1: Electrical Engineering)" (curriculum PDF table).
* **One ESC slot carries two titles depending on group.** The S3 slot F row is printed as `GAEST305/ GNEST305` with "Group A: Digital Electronics & Logic Design" and "Group B, C and D: Introduction to Artificial Intelligence and Data Science" — so the same slot holds entirely different courses by group.
* **The S6 ESC course is titled inconsistently inside the same curriculum PDF.** The S6 semester table prints `EST605` "Design Thinking and Product Development (Group Specific Syllabus)"; the per-group ESC summary tables then print it as "Design Thinking and Product Development" for Group A but **"Design Thinking and Creativity"** for Groups B, C and D.

### 5.4 Structural / formatting variations inside syllabus PDFs

* **Qualifier line optional**: `PCCST302` and `PCCST303` carry `(Common to CS/CA/CM/…)`; `PCECT302` has none.
* **Line wrapping in the header block**: `PCCST302` wraps `Teaching Hours/Week (L: T:P: R)` onto its own line, so a regex keyed to a single line fails.
* **Colon spacing in the L-T-P-R label**: `UCEST105` prints `(L: T:P: R)`; `PCCST302` prints `(L: T:P: R)` too but `GAMAT101` prints `3:0:0:0` inline. The exact literal `(L: T:P: R)` with a missing space in the middle is the reliable anchor.
* **Contact hours are not uniform**: `9,9,9,9` (`GAMAT101`, `UCEST105`) · `11,11,11,11` (`PCCST302`, `PCCST303`) · `13,12,11,8` (`PCECT302`) · `6,6,6,6` (`UCHUT346`). Nothing guarantees equal modules or a fixed total.
* **CO count varies 4 vs 5**; the CO cell concatenates label+statement.
* **`Analyse` vs `Analyze`** in the same K1–K6 note line, and both spellings can appear in one document.
* **CO-PO table placement varies**: normally before Text Books, but in `PCCST303` it is emitted after the Reference Books table; in `UCHUT346` the table body is empty.
* **CO-PO table row-label position varies** (label can land after the numeric cells).
* **CIE column labels drift**: `Assignment/ Microproject` vs `Assignment/Case Study/ Microproject` vs `Continuous Assessment (Accurate Execution of Programming Tasks)`; some CIE tables have 4 data columns, `UCEST105` has 5.
* **Half-marks appear**: `UCHUT346` prints `12.5`.
* **CO-PO caption typos are in the source** (`Mapping od Course Outcomes`), so don't match the caption exactly.
* **Model question paper sometimes embedded** in the syllabus PDF (`UCHUT346`) and sometimes a separate document (`GAMAT101`).
* **Section headings are sometimes rendered as `#` markdown headings** by text extraction (e.g. `# SEMESTER S1 …`, `# SYLLABUS`) and sometimes as plain text (`SYLLABUS` in `GAMAT101`, `SYLLABUS` inline in `PCCST302`). Heading level is not reliable.
* **Two different revisions of the same syllabus circulate**: `GAMAT101` Module 4 cites `[Relevant topics from: Text-1 section 14.8, Text-2 sections 22.1, 22.2]` in the `ktu.notesundo.in` copy but `22.1, 22.2, 22.3` in the `ktunotes.in`/Google Drive copy. Same course, same semester, different text.
* **Mirror metadata mismatches**: on `ktu.notesundo.in` the page `…/solid-state-devices-ssd-PCECT302` is titled "Solid State Devices" but the linked asset is named `Analog-Circuits-PCECT302`, and the API path `…/api/download/BCq1DLg7` returns a file whose internal heading is `SEMESTER S3 SOLID STATE DEVICES`. **Trust the PDF's internal `Course Code`/heading, not the URL slug or the asset filename.**

### 5.5 Practical parser guidance

* Anchor on the literal strings `Course Code`, `Teaching Hours/Week`, `CIE Marks`, `ESE Marks`, `Exam Hours`, `Prerequisites (if any)`, `Course Type` — these were stable across all six documents.
* Read the code from the `Course Code` field, never from a filename or URL slug.
* Treat `Credits`, `CIE Marks`, `ESE Marks` and `Exam Hours` as **independent scalars**, not a tuple.
* Split module text on `;` and on the `ALL-CAPS …:-` lead-in pattern, and keep the bracketed `[Relevant topics from: …]` line as a separate field.
* Read the Part A/Part B numbers from the `Part A`/`Part B` cells rather than assuming 8×3 and 4×9 — `UCHUT346` proves the pattern is course-type dependent.
* Strip `*`/`**` footnote markers inside module cells and resolve them against the trailing explanation in the same cell.

---

## 6. Real syllabus source URLs

### 6.1 Official KTU pages — reachable, but they yield NO extractable PDF links

The KTU Academics area is a **client-rendered single-page app**. Fetching these returns site chrome only; the syllabus list and its PDF anchors are injected by JavaScript after load, so a non-JS fetcher sees nothing. I verified this on all four:

| Official URL | What it claims to be | What a fetch actually returns |
|---|---|---|
| `https://www.ktu.edu.in/academics/scheme` | "Regulations & Syllabus", heading `Scheme - B-TECH` | site navigation only; **no course or PDF links** |
| `https://www.ktu.edu.in/academics/branchsyllabus` | branch-wise syllabus | site navigation only; **no links** |
| `https://www.ktu.edu.in/academics/branchcurriculum/hardcoded-btech` | "B.TECH FULL TIME 2024 CURRICULUM" | site navigation only; **no links** |
| `https://www.ktu.edu.in/academics/view-questionpapers` | question papers | site navigation only; **no links** |

Also note: **the apex host `ktu.edu.in` fails TLS** with `ERR_CERT_COMMON_NAME_INVALID`; only `www.ktu.edu.in` resolves. `https://ktu.edu.in/academics/branchsyllabus` (as given in the brief) fails outright.

**A search-engine-indexed URL, `https://ktu.edu.in/data/Syllabus for S1 and S2_KTU.pdf`, was tested and does NOT serve a PDF** — it returns the SPA HTML shell. Treat it as dead.

**Conclusion: I found no working direct PDF URL on ktu.edu.in for a 2024-scheme course syllabus.** The official *whole-document* PDFs below are the ones I could actually read, obtained from college mirrors.

### 6.2 Official KTU documents via college mirrors — these DO work

| URL | Document |
|---|---|
| `http://me.cet.ac.in/downloads/26-09-2025/B.Tech%20Academic%20Regulations%20KTU%202024%20Scheme.pdf` | **B.Tech (Regular) Academic Regulations, 2024** — 72 pages, official KTU text |
| `https://nssce.ac.in/pdf/B.TechRegulation_2024.pdf` | same regulations, alternate mirror |
| `https://sngce.ac.in/user/files/B_%20Tech%20Regulations_%202024(1).pdf` | same regulations, alternate mirror |
| `https://cetkr.ac.in/uploads/KTU_B.%20Tech_%20Curriculum_%202024.pdf` | **B.Tech Curriculum, 2024** — 17 pages, group tables, all 8 semesters, category credit totals |

Both documents carry the KTU running footer/`www.ktu.edu.in` contact block and are the official artefacts.

### 6.3 Per-course syllabus PDFs — unofficial mirror (works, text-extractable)

All six are direct `application/pdf` endpoints on a third-party mirror. **These are unofficial hosts**, but each file is an unmodified KTU document (running header `B.Tech 2024 –S1/S2`, footer `APJ Abdul Kalam Technological University`).

| URL → course | Course | How it is linked |
|---|---|---|
| `https://ktu.notesundo.in/api/download/pmh2Mu24` | `UCEST105` Algorithmic Thinking with Python | HTML subject page → `View` (`/s/pmh2Mu24`) or `Download` (`/api/download/pmh2Mu24`); opaque base62 id |
| `https://ktu.notesundo.in/api/download/VEcvDnF1` | `GAMAT101` Mathematics for Information Science-1 | same pattern (`/s/VEcvDnF1`) |
| `https://ktu.notesundo.in/api/download/bBig57Ev` | `PCCST302` Theory of Computation | same pattern (`/s/bBig57Ev`) |
| `https://ktu.notesundo.in/api/download/MqcvzosU` | `PCCST303` Data Structures and Algorithms | same pattern (`/s/MqcvzosU`) |
| `https://ktu.notesundo.in/api/download/BCq1DLg7` | `PCECT302` Solid State Devices | same pattern (`/s/BCq1DLg7`) |
| `https://ktu.notesundo.in/api/download/YTsqXxPx` | `UCHUT346` Economics for Engineers | same pattern (`/s/YTsqXxPx`) |

Navigation path for all of them: `https://ktu.notesundo.in/syllabus/2024` → branch (`/syllabus/2024/cse`) → semester (`/syllabus/2024/cse/s1`) → subject (`…/algorithmic-thinking-with-python-atwp-UCEST105`) → PDF.

### 6.4 Second mirror: ktunotes.in (Google Drive links)

`https://ktunotes.in/ktu-s1-cse-syllabus-2024-scheme/` lists each S1 CSE course as a **Google Drive file link** (`https://drive.google.com/file/d/<id>/view`), confirmed to resolve to real syllabus PDFs (`<id>` → title):

| Google Drive URL | Course |
|---|---|
| `https://drive.google.com/file/d/1Lq18aPPxPtKDeGH8rGB7gxGttAav7LIN/view` | `GAMAT101` (file title `MATHEMATICSFORINFORMATIONSCIENCE.pdf`) |
| `https://drive.google.com/file/d/1n44JV-8pEYeEWOHx1Xb57Gr6V73pE_6b/view` | `GAPHT121` Physics for Information Science |
| `https://drive.google.com/file/d/1E99YErSJQGR7ooMlsd15Qg6cuOSsxzw1/view` | `GXCYT122` Chemistry |
| `https://drive.google.com/file/d/1P-F5oBAc2ffNZtk9cHS9uj4kb-iCT3S0/view` | `GMEST103` Engineering Graphics and CAD |
| `https://drive.google.com/file/d/1Q3z9je-vijRyfE4TlCd36myGV0gBVPCg/view` | `GXEST104` Intro to Electrical & Electronics Engg |
| `https://drive.google.com/file/d/1X1C97Af6Yhsfi6lfw8Q-EIdMFbHYTJ6B/view` | `UCEST105` Algorithmic Thinking with Python |
| `https://drive.google.com/file/d/1v9QiN33SiO0hrQC6FovB55BMyvj6pTSk/view` | `UCHWT127` Health and Wellness |
| `https://drive.google.com/file/d/1N6xN4wXwPkwEljqpNN-gR8XKONWQTscz/view` | `UCHUT128` Life Skills and Professional Communication |

**Real model question papers** (2024 scheme), linked from `model.ktunotes.live`:

| URL | Content |
|---|---|
| `https://model.ktunotes.live/s1/a/gamat101` (paper at `https://drive.google.com/file/d/1H0g0MgYYVr8V1mhEnIMk--8JZlisGD1D/view`) | `GAMAT101` model question paper, PART A/B, 60 marks, 2 h 30 min — quoted verbatim in §4.3 |
| `https://model.ktunotes.live/s1/a` | index of S1 Group A papers: `UCEST105`, `GXCYT122`, `GMEST103`, `GXEST104`, `GAMAT101`, `GAPHT121` |

### 6.5 Other sources consulted (non-official; used only for cross-checking)

* `https://ktunotes.in/curriculum/2024/cse/` — full CSE 2024 curriculum with L‑T‑P‑R, credits, all elective baskets, Level 5 markings, **170 total credits**. Used to cross-check codes/credits/titles. Values matched the official curriculum PDF.
* `https://ktu.notesundo.in/syllabus/2024` — branch index (17 branches, 2024 scheme).
* `https://ktunotes.in/ktu-pccst303-notes-2024-scheme/`, `https://ktunotes.in/ktu-algorithmic-thinking-with-python-notes-ucest105/`, `https://ktunotes.in/ktu-mathematics-for-information-science-notes-gamat101/` — module topics **in paraphrase** plus a plain-language exam-pattern summary. `ktunotes.in`'s GAMAT101 summary states `2 hours 30 minutes`, Part A eight 3-mark questions (two per module), Part B two 9-mark questions per module with one chosen — which **matches** the official syllabus PDF exactly.
* `https://www.btechtutor.com/ktu/syllabus-2024` — non-official marketing page. Its "170 credits" claim matches the regulation, but its "Python replaced C" and "Honours/Minor from S5" claims are **contradicted** by official documents (see §1.6).
* `https://www.golearnerz.com/blog/KTU-Btech-2024-Scheme-Syllabus-and-Curriculum` — branch/scheme list only; no verifiable module text.

---

## 7. Not verified / open gaps

1. **No official ktu.edu.in PDF URL** for any individual 2024-scheme course syllabus (§6.1). Everything per-course came from mirrors.
2. **No standalone official "Question Paper Pattern"** document exists that I could locate; the pattern lives inside each syllabus and in model papers (§4).
3. **Lab / practical course syllabi** (`GXESL106`, `PCCSL307`, `PCCSL308`) and **seminar/project/mini-project** syllabi were not retrieved, so their header blocks and assessment tables are unknown. Only their credits (1–2) and L‑T‑P‑R values from the curriculum are recorded.
4. **Level 5 course syllabi** were not retrieved; their 5-credit header format is therefore unconfirmed by a real document.
5. **S4–S8 course codes** are known from the curriculum index but only S1–S4 codes were seen in syllabus documents.
6. **2019-scheme code format** was not examined, so no 2019→2024 code-mapping claim is made.
7. **Branch-specific module content for non-CSE/ECE branches** was not retrieved beyond the common S1/S2 courses.
8. **The 160 vs 167 vs 170 distinction** is stated per the regulation; a given department's local documents may quote any of these.
