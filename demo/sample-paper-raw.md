# Real KTU end-semester question papers — verbatim transcriptions

Two **real KTU end-semester examination question papers** (both 2024 scheme) transcribed below, followed by the
evidence for the paper pattern.

**Transcription conventions**
* Text is verbatim from the paper's own text layer. Header lines that the PDF stores in a separate text box
  (university name / exam line / `Reg No.:` rule, and the `Pages: n` box) are shown in their logical
  on-page position, i.e. in the header block, even though a text extractor emits them at the end of page 1.
* `[reflowed]` marks a line where the original stacks a fraction/limit vertically and the text layer emits the
  numerator and denominator on separate lines; the tokens are unchanged, only joined onto one line.
* `[FIGURE: …]` marks a figure that exists in the paper but has no text representation.
* Nothing below is invented, reworded or reordered by question content. Marks, `CO` tags and numbering are
  exactly as printed.

---

# Sample Paper 1

<!-- source: https://www.scribd.com/document/953356125/Ucest105-Algorithmic-Thinking-With-Python-Dec-2024-Solved -->
<!-- read via: https://r.jina.ai/https://www.scribd.com/document/953356125/Ucest105-Algorithmic-Thinking-With-Python-Dec-2024-Solved -->
<!-- paper: UCEST105 Algorithmic Thinking with Python — APJ Abdul Kalam Technological University,
     First Semester B.Tech Degree Regular Examination December 2024 (2024 Scheme). Scheme: 2024. -->

```
03 UCEST105 122402
Page 1 of 4

APJ ABDUL KALAM TECHNOLOGICAL UNIVERSITY
First Semester B.Tech Degree Regular Examination December 2024 (2024 Scheme)

Reg No.:_______________ Name:__________________________
```

```
Course Code: UCEST105
Course Name: ALGORITHMIC THINKING WITH PYTHON

Max. Marks: 60                              Duration: 2 hours 30 minutes
```

## PART A

(Answer all questions. Each question carries 3 marks)

CO Marks

1 You are asked to solve a jigsaw puzzle without a reference picture. How will you solve it using trial and
error method? CO-1 (3)

2 Given the input "1234 5", write a Python code snippet to check if it is numeric. CO-1 (3)

3 Draw the flowchart to generate the first 'n' numbers in the Fibonacci sequence. CO-2 (3)

4 Write an algorithm to check whether the input integer is Palindrome or not. CO-2 (3)

5 Write the output produced by the following code. CO-3 (3)

   (i)

   ```
   for count in range(-10,-20,-2) :
       print(count, end=" ")
   ```

   (ii)

   ```
   for i in range(10,-1,-2):
       print(i)
   ```

   (iii) `2*3**2**2`

6 Write a Python program to find the sum of even numbers from N given numbers. CO-3 (3)

7 What is the motivation for using a randomized approach in problem-solving? CO-4 (3)

8 You are a software engineer working on a security application for a company that handles sensitive user
data. The application has a 4-digit numeric password system for authentication. However, due to a system
error, a user has forgotten their password. Write an algorithm for recovering the 4-digit numeric password.
CO-4 (3)

---

*Page 2 of 4*

## PART B

(Answer any one full question from each module, each question carries 9 marks)

### Module -1

9 a) Explain how backtracking strategy can be applied to solve Sudoku problem? CO-1 (5)

   b) Your college is located in a metropolitan city and you are new to that city. You would like to go out
   for dinner with your friends. Explain how heuristics approach can be used to find the best restaurant for
   dinner. CO-1 (4)

10 a) You are asked to develop new campus management software for your college. How will you apply
Means-Ends Analysis to develop the software? CO-1 (6)

    b) Given the area of a circle. Write a Python program to calculate the radius of the circle using the
    `math` module. CO-1 (3)

### Module -2

11 a) Write a pseudocode to implement a grading system based on the following conditions.

* Marks ≥ 90: Grade A
* Marks 80–89: Grade B
* Marks 70–79: Grade C
* Marks 60-70: Grade D
* Marks 50-69: Grade E
* Marks <50 : Grade F
* If the difference between the marks and the next multiple of 10 is less that 3, then convert it to next
  grade.
* If the marks are below 50, no need to convert even if the difference is less than 3.

CO-2 (6)

    b) You are a software developer working on a data analysis tool for a logistics company. The company has
    a list of delivery times, where each entry represents the time taken (in minutes) for a particular
    delivery. The team needs to identify delivery times that are divisible by 6 (as they are considered
    optimal delivery durations) but not divisible by 4 (as they tend to involve more complexity in
    scheduling). Write an algorithm to print the delivery times that are divisible by 6 but not divisible
    by 4 from a given set of delivery times. (3)

12 a) You are developing a feature for a business analytics tool that processes a list of sales figures for a
company. As part of the analytics, the tool must identify the highest and lowest sales figures from the
provided data. Write the pseudocode to determine the largest and smallest numbers in a given list of N
numbers, ensuring the solution is efficient for real-world applications. CO-2 (6)

    b) Write the pseudocode to calculate the factorial of a given number using a `for` loop. CO-2 (3)

---

*Page 3 of 4*

### Module -3

13 a) You are working as a software engineer for a financial analysis company. The company uses Fibonacci
sequences to model certain financial growth patterns, such as project milestones or revenue projections.
You are tasked with developing a tool that generates the first 'n' numbers in the Fibonacci sequence to
assist in creating projections for clients. You should use recursion to solve it. CO-3 (5)

    b) Write a program that accepts the length of three sides of a triangle as input and determine whether
    or not the triangle is a right triangle. CO-3 (4)

14 a) You are given two positive integers, a and b. Write a Python program using recursion to find the Least
Common Multiple (LCM) of these integers. You are not allowed to directly calculate the LCM formula, but
must instead use the relationship between GCD and LCM. CO-3 (6)

> Note: For any two positive integers, the product of their LCM and GCD is equal to the product of the two
> numbers. In other words, LCM(a,b)×GCD(a,b)=ab

    b) You are working on a text-processing application for a content moderation team. The team needs a
    feature to analyze user-generated sentences and reorganize their characters for better readability and
    analysis. Specifically, they want all capital letters to appear first, followed by small letters, then
    digits, and finally any special characters. Write a Python program to implement this feature, ensuring
    the reorganized output is displayed as a single word. CO-3 (3)

### Module -4

15 a) You are working as a financial analyst for a bank. The bank has received a list of loan interest rates
from multiple branches, and you need to identify the two lowest rates to recommend the most cost-effective
options to customers. The rates are provided as an array of positive integers, and your task is to develop
an efficient algorithm using the Divide and Conquer approach to find the sum of the two smallest rates.
Explain with a suitable example. CO-4 (6)

    b) Compare and contrast greedy approach and dynamic programming approach. CO-4 (3)

16 a) Explain memoization and tabulation techniques in dynamic programming for calculating the n-th
Fibonacci number CO-4 (6)

    b) Solve the following: You are given an array of positive integers where each integer represents the
    time taken to complete a task. Develop a greedy algorithm to determine the maximum number of tasks you
    can complete in a given total time limit. Explain your reasoning behind each step of the solution.
    CO-4 (3)

---

*Page 4 of 4*

```
Downloaded from Ktunotes.in
```

<!-- End of paper. Notes on this transcription:
     - Filename of the source PDF, as printed on it: "03 UCEST105 122402" is the per-page routing code; the
       paper is 4 pages ("Page 1 of 4" … "Page 4 of 4").
     - No "Pages: n" box token appeared in the text layer of this paper (unlike GAMAT101, see Sample Paper 2).
     - No end-of-paper "*****" marker appeared in the text layer of this paper.
     - The uploaded document continues for 18 more pages with worked solutions; only the question paper
       (pages 1–4 of the upload) is transcribed here.
     - Q11 b) carries no CO tag in the source text; that is as printed/extracted.
     - No figures are required to state the questions; Q3/Q4 ask candidates to draw flowcharts. -->

---

# Sample Paper 2

<!-- source: https://drive.google.com/file/d/1mfmBZ29HxkqoplA6UcOUQM9k_X5VXdnC/view -->
<!-- mirrored from: https://ktuspecial.in/ktu-gamat101-mathematics-for-information-science1-question-papers-2024-scheme-s1-geoup-a/ -->
<!-- read via: https://r.jina.ai/https://drive.google.com/file/d/1mfmBZ29HxkqoplA6UcOUQM9k_X5VXdnC/view -->
<!-- paper: GAMAT101 Mathematics for Information Science-1 — APJ Abdul Kalam Technological University,
     First Semester B.Tech Degree Regular Examination December 2024 (2024 Scheme). Scheme: 2024. -->

```
03GAMAT101122402
Page 1 of 3

Course Code: GAMAT101
Course Name: MATHEMATICS FOR INFORMATION SCIENCE-1

Max. Marks: 60                              Duration: 2 hours 30 minutes
```

## PART A

(Answer all questions. Each question carries 3 marks)

CO Marks

1 At what points are the function g(x) = { (x²−x−6)/(x−3), x ≠ 3 ; 5 , x = 3 } continuous. CO1 3

2 Find the first and second derivatives of x³ + 7/x . CO1 3

3 [reflowed] Find lim(x,y)→(0,0) (1 − cos(xy)) / xy CO2 3

4 Show that wxy = wyx where w = e^x + x lny + y lnx. CO2 3

5 What are the directions of zero change in f(x, y) = x²/2 + y²/2 at (1,1) CO3 3

6 Find the critical points of the function f(x, y) = 5xy − 7x² + 3x − 6y + 2. CO3 3

7 Find the extreme points of f(x, y) = xy subject to the constraints x + y = 16 CO4 3

8 Form the LPP by maximising the profit: DC Drug company produces two types of liquid pain killer,
N(normal) and S(super). Each bottle of N requires 2 units of drug A, 1 unit of drug B and 1 unit of drug C.
Each bottle of S requires 1 unit of A, 1 unit of B, 3 units of C. The company is able to produce each week
only 1400 units of A, 800 units of B and 1800 units of C. The profit per bottle of N and S is $11 and $15
respectively. CO4 3

```
A     Pages: 3

APJ ABDUL KALAM TECHNOLOGICAL UNIVERSITY
First Semester B.Tech Degree Regular Examination December 2024 (2024 Scheme)

Reg No.:_______________ Name:__________________________
```

*(The standalone `A` before `Pages: 3` is an extraction artifact of the box that surrounds the page count.)*

---

*Page 2 of 3*

## PART B

(Answer any one full question from each module, each question carries 9 marks)

### Module -1

9 a) [reflowed] Find lim(x→0) ( 1/(x−1) + 1/(x+1) ) / x CO1 3

   b) Find the linearization of f(x) = cosx at x = π/2 . CO1 3

   c) Determine the concavity of f(x) = x³ − 6x² + 9x + 1. CO1 3

10 a) Show that y = |x| is differentiable on (−∞, 0) and (0, ∞), but has no derivative at x = 0. CO1 6

    b) The area A of a circle is related to its diameter D by the equation A = π/4 D². How fast does the
    area change with respect to the diameter when diameter is 10m. CO1 3

### Module -2

11 a) [reflowed] Find ∂²w/∂y∂x if w = xy + e^y / (y²+1) CO2 3

    b) [reflowed] Find the limit of the function lim(x,y)→(0,0) (x²−xy) / (√x−√y) . CO2 3

    c) Find ∂f/∂x , ∂f/∂y and ∂f/∂z for the function f(x, y, z) = e^x/y + e^z/y CO2 3

12 a) Find the domain and range of the function g(x, y) = ln (x²+y²) CO2 3

    b) If w = e^(x²y) , x = √(uv) , y = 1/v , find ∂w/∂u and ∂w/∂v at (2,2) using chain rule. CO2 6

### Module -3

13 a) If w = f(x − y, y − z, z − x), show that ∂w/∂x + ∂w/∂y + ∂w/∂z = 0. CO3 5

    b) Find the directional derivative at (1,-1) of g(x, y) = (x−y)/(xy+2) in the direction of
    v⃗ = 12i⃗ + 5j⃗ . CO3 4

14 a) Find the local extrema of f(x, y) = 10xy e^(−(x²+y²)) CO3 6

---

*Page 3 of 3*

    b) Find the gradient of f(x, y) = x² − xy + y² − y at (1, −1) CO3 3

### Module -4

15 a) Find the point P(x, y, z) on the plane 2x + y − z − 5 = 0 that is close to the origin. CO4 6

    b) Minimise the function f(x, y) = x² + y² with starting point (1,1) with step size, α = 0.1 in two
    iterations by the method of steepest descent. CO4 3

16 a) Find the largest and smallest values the function f(x, y) = xy takes on the ellipse
x²/8 + y²/2 = 1 by Lagrange's multiplier method. CO4 5

    b) Solve the following LPP graphically:

    Maximise z = 6x1 + 11 x2 subject to

    2x1 + x2 ≤ 104
    x1 + 2x2 ≤ 76
    x1 ≥ 0 , x2 ≥ 0

    CO4 4

```
*****
```

<!-- End of paper. Notes on this transcription:
     - Per-page routing code: 03GAMAT101122402. Paper length: 3 pages ("Page 1 of 3" … "Page 3 of 3"),
       page-count box on page 1: "Pages: 3".
     - In this paper the marks column is printed as a BARE number (CO1 3), with no parentheses,
       unlike UCEST105 / the model papers which print (3). Both forms are real (see docs/ktu-paper-structure.md §3).
     - The uploaded PDF is 11 pages: page 1 is a WWW.KTUSPECIAL.IN cover/watermark page, pages 2–4 are the
       paper, pages 5–11 are a solved/answer version. Only the question paper is transcribed here.
     - No figures are required to state the questions; the only non-text element in Part B is the
       vector notation in Q13 b) (v⃗ = 12i⃗ + 5j⃗), reproduced here in plain text.
     - The document ends with the literal "*****" marker. -->

---

## Paper pattern evidence

All rows are evidence for **Part A / Part B sizes, module counts, marks and duration** in real KTU papers.

| # | Paper | Scheme | Header evidence (verbatim) | Part A | Part B | Total / duration | Source URL |
|---|---|---|---|---|---|---|---|
| E1 | **UCEST105** Algorithmic Thinking with Python, S1 Regular **Dec 2024** (real exam) | 2024 | `Course Code: UCEST105` · `Course Name: ALGORITHMIC THINKING WITH PYTHON` · `Max. Marks: 60` · `Duration: 2 hours 30 minutes` | `PART A` / `(Answer all questions. Each question carries 3 marks)` — Q1–Q8 | `PART B` / `(Answer any one full question from each module, each question carries 9 marks)` — `Module -1` … `Module -4`, Q9–Q16 as 4 pairs | 60 marks · 2 h 30 min · 8 + 8 questions | https://www.scribd.com/document/953356125/Ucest105-Algorithmic-Thinking-With-Python-Dec-2024-Solved |
| E2 | **GAMAT101** Mathematics for Information Science-1, S1 Regular **Dec 2024** (real exam) | 2024 | `Course Code: GAMAT101` · `Course Name: MATHEMATICS FOR INFORMATION SCIENCE-1` · `Max. Marks: 60` · `Duration: 2 hours 30 minutes` · `Pages: 3` | `PART A` / `(Answer all questions. Each question carries 3 marks)` — Q1–Q8 | `PART B` / `(Answer any one full question from each module, each question carries 9 marks)` — `Module -1` … `Module -4`, Q9–Q16 | 60 marks · 2 h 30 min · 8 + 8 questions | https://drive.google.com/file/d/1mfmBZ29HxkqoplA6UcOUQM9k_X5VXdnC/view (via https://ktuspecial.in/ktu-gamat101-mathematics-for-information-science1-question-papers-2024-scheme-s1-geoup-a/) |
| E3 | **GAMAT101** S1 **May 2025** Supplementary (real exam) | 2024 | `B.Tech Degree S1 (S) Examination May 2025 (2024 Scheme)` · `Max. Marks: 60` · `Duration: 2 hours 30 minutes` · `Pages: 3` · code `03GAMAT101122403X` | Q1–Q8 × 3 marks | `(Answer any one full question from each module, each question carries 9 marks)` · `Module -1` … `Module -4`, Q9–Q16 | 60 marks · 2 h 30 min · 8 + 8 questions | https://drive.google.com/file/d/175hHcY09GfunSg9XEh7kxVSrhnkztgSb/view |
| E4 | **PCCST303** Data Structures and Algorithms, **S3 (R) (FT/WP) Nov 2025** (real exam, scanned) | 2024 | `B.Tech Degree S3 (R) (FT/WP) Examination November 20…` · `Course code: PCCST303` · `Duration: 2 hours 30 minutes` `[OCR]` | `(Answer all questions. Each … carries 3 marks)` — Q1–Q8 `[OCR]` | `PART 8` (= PART B, OCR) / `nswer any one fiu[l question firom e[ach module,] each question carries 9 marks` `[OCR]` — `Module 4`, `M ule -2` `[OCR]`, Q9–Q16 | 60 marks · 2 h 30 min (per paper code `06PCCST303112503`) | https://ktunotes.in/pccst303-question-papers-ktu-2024-scheme-data-structures-and-algorithms/ → https://drive.google.com/file/d/1l-v9zWeoqPcjYWka7rA_l2ciaGbAzTwa/view |
| E5 | **UCEST105** published **KTU model question paper** | 2024 | `MODEL QUESTION PAPER` · `APJ ABDUL KALAM TECHNOLOGICAL UNIVERSITY` · `FIRST SEMESTER B. TECH DEGREE EXAMINATION, DECEMBER 2024` · `Max. Marks: 60 Duration: 2 hours 30 minutes` | `PART A` / `Answer all questions. Each question carries 3 marks` — Q1–Q8 | `PART B` / `Answer any one full question from each module. Each question carries 9 marks` — `Module 1` … `Module 4`, Q9–Q16 | 60 marks · 2 h 30 min | https://drive.google.com/file/d/1FyU8sM2j6yvO9qInZyOerUt17QCKhzZK/view (also https://www.scribd.com/document/790223089/UCEST105-Algorithmic-thinking-with-Python-MODEL-QP-SEMESTER-1) |
| E6 | **GAMAT101** published **KTU model question paper** | 2024 | `MODEL QUESTION PAPER` · `… FIRST SEMESTER B. TECH DEGREE EXAMINATION, DEC 2024` · `Max. Marks: 60 Duration: 2 hours 30 minutes` | `PART A` / `Answer all questions. Each question carries 3 marks` — Q1–Q8, sub-parts `a) (2) b) (3) c) (4)` | `PART B` / `Answer any one full question from each module. Each question carries 9 marks` — `Module 1` … `Module 4` | 60 marks · 2 h 30 min | https://drive.google.com/file/d/1H0g0MgYYVr8V1mhENImK--8JZlisGD1D/view |
| E7 | **GAPHT121 / GXCYT122 / GMEST103 / GXEST104** S1 Group A model set (same set, other courses) | 2024 | `MODEL QUESTION PAPER` · `FIRST/SECOND SEMESTER B. TECH DEGREE EXAMINATION, MONTH AND YEAR` · `Max. Marks: 60 Duration: 2 hours 30 minutes` | `PART A` / `Answer all questions. Each question carries 3 marks` | `PART B` / `Answer any one full question from each module. Each question carries 9 marks` | 60 marks · 2 h 30 min | https://www.scribd.com/document/783897872/s1-Group-A-model-Qp-b-Tech-2024-Scheme-1 · https://model.ktunotes.live/s1/a |
| E8 | **HUT300** Industrial Economics & Foreign Trade, S6 (R&S) **July 2023** (real exam, valuation scheme) | 2019 | `SIXTH SEMESTER B. TECH DEGREE (R&S) EXAMINATION, JULY 2023` · `Course Code: HUT300` · `Max. Marks: 100` · `Duration: 3 Hours` · code `1200HUT300052301` | `PART A` / `Answer all questions, each carries 3 marks.` — Q1–Q10 | `PART B` / `Answer one question from each module, each carries 14 marks.` — `Module I`, `Module II`, `OR` between paired questions | 100 marks · 3 hours | https://www.scribd.com/document/876879271/Hut300-June-2023-As |
| E9 | **MAT 206** Graph Theory, S4 (2019-scheme model paper) | 2019 | `APJ ABDUL KALAM TECHNOLOGICAL UNIVERSITY FOURTH SEMESTER B.TECH DEGREE EXAMINATION` · `Course Code: MAT 206` · `Max Marks: 100` · `Duration: 3 Hours` | `PART-A` / `(Answer All Questions. Each question carries 3 marks)` — Q1–Q10, marks `(3)` | `PART-B` / `(Answer any one question from each module. Each question carries 14 Marks)` — Q11–Q20 with literal `OR` between pairs; sub-part marks sum to 14 (`(6)+(8)`, `(5)+(9)`, `(7)+(7)`, `(4)+(10)`) | 100 marks · 3 hours | https://www.keralanotes.com/p/ktu-graph-theory-2019-model-question.html |
| E10 | **Official KTU regulations** (marks/assessment rule behind the 60-mark ESE) | 2024 | `R 7.3 … the ratio of Continuous Internal Evaluation (CIE) to End Semester Examinations (ESE) shall be as follows: 1. Theory Courses - 2: 3` | — | — | For a 100-mark course: CIE 40 : ESE 60 (`2:3`) | http://me.cet.ac.in/downloads/26-09-2025/B.Tech%20Academic%20Regulations%20KTU%202024%20Scheme.pdf |

**Pattern conclusions supported by E1–E10**

* 2024-scheme theory papers: **Max. Marks 60, Duration 2 hours 30 minutes**, `PART A` = 8 questions × 3 marks = 24,
  `PART B` = 4 modules × 9 marks (`Module -1` … `Module -4`), 8 Part-B questions (`9`–`16`) of which one per module
  is answered ⇒ 24 + 36 = 60. Observed at S1 (Dec 2024, May 2025) and S3 (Nov 2025) and in the official S1 model set.
* 2019-scheme theory papers: **Max. Marks 100, Duration 3 Hours**, `PART A` = 10 questions × 3 marks = 30,
  `PART B` = 5 modules × 14 marks, questions `11`–`20` with a literal `OR` between the two questions of each module
  ⇒ 30 + 70 = 100.
* Part labels `PART A` / `PART B` are common to both schemes; the 2019 *model* paper fetched uses the hyphenated
  `PART-A` / `PART-B`.
* Marks are printed per question/sub-part at the right (`(3)`, `3`, `CO1 (5)`, `CO2 6`) with a `CO` column on
  2024-scheme papers and no `CO` column on the 2019-scheme MAT 206 model paper.

**Sources that were checked and rejected as evidence** (no structural claim rests on them):
* `https://www.scribd.com/document/954215754/UCHUT346-Model-Question-Paper` — upload titled
  "KTU MODEL QUESTION PAPER – UCHUT346 Economics for Engineers (2024 Scheme)" showing a three-part
  `PART A (10 × 3) / PART B (5 × 6) / PART C (4 × 10)` 100-mark layout. It matches no KTU-published paper or
  model paper observed and is treated as unofficial.
* Aggregator index pages (`ktunotes.in`, `model.ktunotes.live`, `model.ktunotes.online`, `ktu.notesundo.in`,
  `btechtutor.com`, `ktuspecial.in`, `pyq.ktunotes.live`) were used only to locate paper files.
