/**
 * Build the demo bundle in public/demo/.
 *
 * Everything here is derived from real material:
 *   - the question paper is the verbatim UCEST105 transcript in demo/sample-paper-raw.md
 *   - the syllabus is the real 2024-scheme UCEST105 data in data/ktu-2024-index.json
 *   - the coverage arithmetic, Bloom comparison, hotspots and persona aggregates
 *     are computed by the app's own modules, so the cached report cannot drift
 *     out of sync with what a live run would produce
 *
 * Only the *judgement* text (flag reasons and rewrites, persona pitfalls) is
 * authored here, because that is what a language model would supply live. The
 * bundle is therefore an honest worked example, not a fake model transcript.
 *
 * Run: npm run build:demo
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { syllabusFromIndexCourse, normaliseBloom } from '../public/core/syllabus.js';
import { computeCoverage, computeBloomCheck, computeHotspots, buildReference } from '../public/core/analysis.js';
import { aggregatePersonas } from '../public/core/persona.js';
import { PERSONAS } from '../public/core/personas.js';
import { PROMPT_VERSION, KTU_2024_DEFAULT_PATTERN } from '../public/prompts/prompts.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'demo', 'UCEST105');
const GENERATED_AT = Date.UTC(2026, 0, 15, 9, 30, 0); // fixed, so rebuilds are reproducible

/* ------------------------------------------------------------------ paper */

const PAPER_TEXT = `03 UCEST105 122402
Page 1 of 4

APJ ABDUL KALAM TECHNOLOGICAL UNIVERSITY
First Semester B.Tech Degree Regular Examination December 2024 (2024 Scheme)

Reg No.:_______________ Name:__________________________

Course Code: UCEST105
Course Name: ALGORITHMIC THINKING WITH PYTHON

Max. Marks: 60                              Duration: 2 hours 30 minutes

PART A
(Answer all questions. Each question carries 3 marks)
CO Marks

1 You are asked to solve a jigsaw puzzle without a reference picture. How will you solve it using trial and error method? CO-1 (3)

2 Given the input "1234 5", write a Python code snippet to check if it is numeric. CO-1 (3)

3 Draw the flowchart to generate the first 'n' numbers in the Fibonacci sequence. CO-2 (3)

4 Write an algorithm to check whether the input integer is Palindrome or not. CO-2 (3)

5 Write the output produced by the following code. CO-3 (3)
   (i)
   for count in range(-10,-20,-2) :
       print(count, end=" ")
   (ii)
   for i in range(10,-1,-2):
       print(i)
   (iii) 2*3**2**2

6 Write a Python program to find the sum of even numbers from N given numbers. CO-3 (3)

7 What is the motivation for using a randomized approach in problem-solving? CO-4 (3)

8 You are a software engineer working on a security application for a company that handles sensitive user data. The application has a 4-digit numeric password system for authentication. However, due to a system error, a user has forgotten their password. Write an algorithm for recovering the 4-digit numeric password. CO-4 (3)

Page 2 of 4
PART B
(Answer any one full question from each module, each question carries 9 marks)

Module -1

9 a) Explain how backtracking strategy can be applied to solve Sudoku problem? CO-1 (5)
   b) Your college is located in a metropolitan city and you are new to that city. You would like to go out for dinner with your friends. Explain how heuristics approach can be used to find the best restaurant for dinner. CO-1 (4)

10 a) You are asked to develop new campus management software for your college. How will you apply Means-Ends Analysis to develop the software? CO-1 (6)
    b) Given the area of a circle. Write a Python program to calculate the radius of the circle using the math module. CO-1 (3)

Module -2

11 a) Write a pseudocode to implement a grading system based on the following conditions.
   Marks >= 90: Grade A
   Marks 80-89: Grade B
   Marks 70-79: Grade C
   Marks 60-70: Grade D
   Marks 50-69: Grade E
   Marks <50 : Grade F
   If the difference between the marks and the next multiple of 10 is less that 3, then convert it to next grade.
   If the marks are below 50, no need to convert even if the difference is less than 3. CO-2 (6)
   b) You are a software developer working on a data analysis tool for a logistics company. The company has a list of delivery times, where each entry represents the time taken (in minutes) for a particular delivery. The team needs to identify delivery times that are divisible by 6 (as they are considered optimal delivery durations) but not divisible by 4 (as they tend to involve more complexity in scheduling). Write an algorithm to print the delivery times that are divisible by 6 but not divisible by 4 from a given set of delivery times. (3)

12 a) You are developing a feature for a business analytics tool that processes a list of sales figures for a company. As part of the analytics, the tool must identify the highest and lowest sales figures from the provided data. Write the pseudocode to determine the largest and smallest numbers in a given list of N numbers, ensuring the solution is efficient for real-world applications. CO-2 (6)
    b) Write the pseudocode to calculate the factorial of a given number using a for loop. CO-2 (3)

Page 3 of 4
Module -3

13 a) You are working as a software engineer for a financial analysis company. The company uses Fibonacci sequences to model certain financial growth patterns, such as project milestones or revenue projections. You are tasked with developing a tool that generates the first 'n' numbers in the Fibonacci sequence to assist in creating projections for clients. You should use recursion to solve it. CO-3 (5)
    b) Write a program that accepts the length of three sides of a triangle as input and determine whether or not the triangle is a right triangle. CO-3 (4)

14 a) You are given two positive integers, a and b. Write a Python program using recursion to find the Least Common Multiple (LCM) of these integers. You are not allowed to directly calculate the LCM formula, but must instead use the relationship between GCD and LCM. CO-3 (6)
    Note: For any two positive integers, the product of their LCM and GCD is equal to the product of the two numbers. In other words, LCM(a,b) x GCD(a,b) = ab
    b) You are working on a text-processing application for a content moderation team. The team needs a feature to analyze user-generated sentences and reorganize their characters for better readability and analysis. Specifically, they want all capital letters to appear first, followed by small letters, then digits, and finally any special characters. Write a Python program to implement this feature, ensuring the reorganized output is displayed as a single word. CO-3 (3)

Module -4

15 a) You are working as a financial analyst for a bank. The bank has received a list of loan interest rates from multiple branches, and you need to identify the two lowest rates to recommend the most cost-effective options to customers. The rates are provided as an array of positive integers, and your task is to develop an efficient algorithm using the Divide and Conquer approach to find the sum of the two smallest rates. Explain with a suitable example. CO-4 (6)
    b) Compare and contrast greedy approach and dynamic programming approach. CO-4 (3)

16 a) Explain memoization and tabulation techniques in dynamic programming for calculating the n-th Fibonacci number. CO-4 (6)
    b) Solve the following: You are given an array of positive integers where each integer represents the time taken to complete a task. Develop a greedy algorithm to determine the maximum number of tasks you can complete in a given total time limit. Explain your reasoning behind each step of the solution. CO-4 (3)

Page 4 of 4
`;

/**
 * The 16 questions as printed. `topics` are keyword fragments used to locate the
 * real syllabus topics for each question, so the topic mapping is reproducible
 * rather than hand-typed ids.
 */
const QUESTIONS = [
  { id: 'A1', part: 'Part A', label: '1', marks: 3, module: 1, co: 'CO1', text: 'You are asked to solve a jigsaw puzzle without a reference picture. How will you solve it using trial and error method?', topics: ['Trial and Error'] },
  { id: 'A2', part: 'Part A', label: '2', marks: 3, module: 1, co: 'CO1', text: 'Given the input "1234 5", write a Python code snippet to check if it is numeric.', topics: ['Numeric and String data types'] },
  { id: 'A3', part: 'Part A', label: '3', marks: 3, module: 2, co: 'CO2', text: "Draw the flowchart to generate the first 'n' numbers in the Fibonacci sequence.", topics: ['FLOWCHART'] },
  { id: 'A4', part: 'Part A', label: '4', marks: 3, module: 2, co: 'CO2', text: 'Write an algorithm to check whether the input integer is Palindrome or not.', topics: ['ALGORITHM AND PSEUDOCODE', 'Sample problems'] },
  { id: 'A5', part: 'Part A', label: '5', marks: 3, module: 3, co: 'CO3', text: 'Write the output produced by the following code. (i) for count in range(-10,-20,-2): print(count, end=" ") (ii) for i in range(10,-1,-2): print(i) (iii) 2*3**2**2', topics: ['range', 'operators and their precedence'] },
  { id: 'A6', part: 'Part A', label: '6', marks: 3, module: 3, co: 'CO3', text: 'Write a Python program to find the sum of even numbers from N given numbers.', topics: ['for loop', 'while loop'] },
  { id: 'A7', part: 'Part A', label: '7', marks: 3, module: 4, co: 'CO4', text: 'What is the motivation for using a randomized approach in problem-solving?', topics: ['Randomized Approach'] },
  { id: 'A8', part: 'Part A', label: '8', marks: 3, module: 4, co: 'CO4', text: 'You are a software engineer working on a security application for a company that handles sensitive user data. The application has a 4-digit numeric password system for authentication. However, due to a system error, a user has forgotten their password. Write an algorithm for recovering the 4-digit numeric password.', topics: ['Brute-force Approach'] },
  {
    id: 'B9', part: 'Part B', label: '9', marks: 9, module: 1, co: 'CO1', choiceGroup: 'B-m1', moduleLabel: 'Module -1',
    text: 'a) Explain how backtracking strategy can be applied to solve Sudoku problem? b) Your college is located in a metropolitan city and you are new to that city. You would like to go out for dinner with your friends. Explain how heuristics approach can be used to find the best restaurant for dinner.',
    subParts: [
      { label: 'a', text: 'Explain how backtracking strategy can be applied to solve Sudoku problem?', marks: 5 },
      { label: 'b', text: 'Your college is located in a metropolitan city and you are new to that city. You would like to go out for dinner with your friends. Explain how heuristics approach can be used to find the best restaurant for dinner.', marks: 4 },
    ],
    topics: ['Backtracking', 'Heuristics'],
  },
  {
    id: 'B10', part: 'Part B', label: '10', marks: 9, module: 1, co: 'CO1', choiceGroup: 'B-m1', moduleLabel: 'Module -1',
    text: 'a) You are asked to develop new campus management software for your college. How will you apply Means-Ends Analysis to develop the software? b) Given the area of a circle. Write a Python program to calculate the radius of the circle using the math module.',
    subParts: [
      { label: 'a', text: 'You are asked to develop new campus management software for your college. How will you apply Means-Ends Analysis to develop the software?', marks: 6 },
      { label: 'b', text: 'Given the area of a circle. Write a Python program to calculate the radius of the circle using the math module.', marks: 3 },
    ],
    topics: ['Means-Ends Analysis', 'math module'],
  },
  {
    id: 'B11', part: 'Part B', label: '11', marks: 9, module: 2, co: 'CO2', choiceGroup: 'B-m2', moduleLabel: 'Module -2',
    note: 'Sub-part b) carries no CO tag in the printed paper; CO2 is taken from the module.',
    text: 'a) Write a pseudocode to implement a grading system based on the following conditions. Marks >= 90: Grade A; Marks 80-89: Grade B; Marks 70-79: Grade C; Marks 60-70: Grade D; Marks 50-69: Grade E; Marks <50: Grade F. If the difference between the marks and the next multiple of 10 is less that 3, then convert it to next grade. If the marks are below 50, no need to convert even if the difference is less than 3. b) You are a software developer working on a data analysis tool for a logistics company. The company has a list of delivery times... identify delivery times that are divisible by 6 but not divisible by 4. Write an algorithm to print the delivery times that are divisible by 6 but not divisible by 4 from a given set of delivery times.',
    subParts: [
      { label: 'a', text: 'Write a pseudocode to implement a grading system based on the stated grade bands and the "next multiple of 10" conversion rule.', marks: 6 },
      { label: 'b', text: 'Write an algorithm to print the delivery times that are divisible by 6 but not divisible by 4 from a given set of delivery times.', marks: 3 },
    ],
    topics: ['case structure', 'Sample problems'],
  },
  {
    id: 'B12', part: 'Part B', label: '12', marks: 9, module: 2, co: 'CO2', choiceGroup: 'B-m2', moduleLabel: 'Module -2',
    text: 'a) You are developing a feature for a business analytics tool that processes a list of sales figures for a company. As part of the analytics, the tool must identify the highest and lowest sales figures from the provided data. Write the pseudocode to determine the largest and smallest numbers in a given list of N numbers, ensuring the solution is efficient for real-world applications. b) Write the pseudocode to calculate the factorial of a given number using a for loop.',
    subParts: [
      { label: 'a', text: 'Write the pseudocode to determine the largest and smallest numbers in a given list of N numbers, ensuring the solution is efficient for real-world applications.', marks: 6 },
      { label: 'b', text: 'Write the pseudocode to calculate the factorial of a given number using a for loop.', marks: 3 },
    ],
    topics: ['largest of n numbers', 'factorial of a number'],
  },
  {
    id: 'B13', part: 'Part B', label: '13', marks: 9, module: 3, co: 'CO3', choiceGroup: 'B-m3', moduleLabel: 'Module -3',
    text: "a) You are working as a software engineer for a financial analysis company. The company uses Fibonacci sequences to model certain financial growth patterns. You are tasked with developing a tool that generates the first 'n' numbers in the Fibonacci sequence. You should use recursion to solve it. b) Write a program that accepts the length of three sides of a triangle as input and determine whether or not the triangle is a right triangle.",
    subParts: [
      { label: 'a', text: "Develop a tool that generates the first 'n' numbers in the Fibonacci sequence using recursion.", marks: 5 },
      { label: 'b', text: 'Write a program that accepts the length of three sides of a triangle as input and determine whether or not the triangle is a right triangle.', marks: 4 },
    ],
    topics: ['Recursion Defined', 'nth Fibonacci number'],
  },
  {
    id: 'B14', part: 'Part B', label: '14', marks: 9, module: 3, co: 'CO3', choiceGroup: 'B-m3', moduleLabel: 'Module -3',
    text: 'a) You are given two positive integers, a and b. Write a Python program using recursion to find the Least Common Multiple (LCM) of these integers. You are not allowed to directly calculate the LCM formula, but must instead use the relationship between GCD and LCM. b) You are working on a text-processing application... all capital letters to appear first, followed by small letters, then digits, and finally any special characters. Write a Python program to implement this feature, ensuring the reorganized output is displayed as a single word.',
    subParts: [
      { label: 'a', text: 'Write a Python program using recursion to find the LCM of two positive integers, using the relationship between GCD and LCM rather than the direct LCM formula.', marks: 6 },
      { label: 'b', text: 'Write a Python program that rearranges a sentence so that capital letters come first, then small letters, then digits, then special characters, printed as a single word.', marks: 3 },
    ],
    topics: ['greatest common divisor', 'Sequence data types'],
  },
  {
    id: 'B15', part: 'Part B', label: '15', marks: 9, module: 4, co: 'CO4', choiceGroup: 'B-m4', moduleLabel: 'Module -4',
    text: 'a) You are working as a financial analyst for a bank... develop an efficient algorithm using the Divide and Conquer approach to find the sum of the two smallest rates. Explain with a suitable example. b) Compare and contrast greedy approach and dynamic programming approach.',
    subParts: [
      { label: 'a', text: 'Develop an algorithm using the Divide and Conquer approach to find the sum of the two smallest rates in an array of positive integers. Explain with a suitable example.', marks: 6 },
      { label: 'b', text: 'Compare and contrast greedy approach and dynamic programming approach.', marks: 3 },
    ],
    topics: ['Divide-and-conquer Approach', 'Greedy Algorithms vs Dynamic Programming'],
  },
  {
    id: 'B16', part: 'Part B', label: '16', marks: 9, module: 4, co: 'CO4', choiceGroup: 'B-m4', moduleLabel: 'Module -4',
    text: 'a) Explain memoization and tabulation techniques in dynamic programming for calculating the n-th Fibonacci number. b) Solve the following: ... Develop a greedy algorithm to determine the maximum number of tasks you can complete in a given total time limit. Explain your reasoning behind each step of the solution.',
    subParts: [
      { label: 'a', text: 'Explain memoization and tabulation techniques in dynamic programming for calculating the n-th Fibonacci number.', marks: 6 },
      { label: 'b', text: 'Develop a greedy algorithm to determine the maximum number of tasks you can complete in a given total time limit. Explain your reasoning behind each step.', marks: 3 },
    ],
    topics: ['Dynamic Programming Approach', 'Greedy Algorithm Approach'],
  },
];

/* --------------------------------------------------------- authored judgement */

/** Flags a reviewer would raise. Reasons and rewrites are authored; nothing else is. */
const AUTHORED_FLAGS = [
  {
    questionId: 'A1', type: 'vague-wording', severity: 'medium',
    reason: 'The question does not say how much of the trial-and-error process is expected, so a one-line answer and a full worked trace would both look defensible to a marker.',
    evidence: 'How will you solve it using trial and error method?',
    rewrite: 'A jigsaw puzzle has 12 pieces and no reference picture. Describe the trial-and-error process you would follow, listing at least three failed placements and explaining how you decide which piece to try next. (3 marks)',
  },
  {
    questionId: 'A2', type: 'multiple-interpretations', severity: 'high',
    reason: 'The input "1234 5" contains a space, so "numeric" could mean the whole string, either token, or the string after stripping, and the three readings give different code.',
    evidence: 'check if it is numeric',
    rewrite: 'Given the string s = "1234 5", write a Python snippet that reports whether s consists only of digits, and state what your snippet prints for s. Name the string method you use. (3 marks)',
  },
  {
    questionId: 'A3', type: 'missing-constraint', severity: 'medium',
    reason: 'A flowchart for the first n Fibonacci numbers is undefined at the start: the question does not say whether 0 and 1 both appear, nor what happens for n = 1.',
    evidence: "generate the first 'n' numbers in the Fibonacci sequence",
    rewrite: "Draw a flowchart that prints the first n Fibonacci numbers, starting from 0 and 1, for any integer n >= 1. Include the decision for the case n = 1 and label the loop's exit condition. (3 marks)",
  },
  {
    questionId: 'A5', type: 'marks-effort-mismatch', severity: 'high',
    reason: 'Three separate outputs are asked for, including an operator-precedence expression, and each needs a trace worth more than the single mark this sub-question can carry.',
    evidence: '(i) ... (ii) ... (iii) 2*3**2**2',
    rewrite: 'Write the output produced by each of the following, and for (iii) show the order in which the operators are evaluated. (i) for count in range(-10,-20,-2): print(count, end=" ") (ii) for i in range(10,-1,-2): print(i) (iii) 2*3**2**2 (3 marks)',
    rewriteMarks: 3,
  },
  {
    questionId: 'A6', type: 'missing-data', severity: 'medium',
    reason: '"N given numbers" never says where the numbers come from or whether negatives count as even, so a correct program can still be marked wrong.',
    evidence: 'sum of even numbers from N given numbers',
    rewrite: 'Write a Python program that reads N, then reads N integers, and prints the sum of those that are even. Treat 0 as even and negative even numbers as even. Show the output for the input 4, then 3 -2 0 7. (3 marks)',
  },
  {
    questionId: 'A7', type: 'vague-wording', severity: 'medium',
    reason: '"Motivation" has no stated scope, so answers range from one sentence to a page and markers have no anchor.',
    evidence: 'What is the motivation for using a randomized approach',
    rewrite: 'State two reasons why a randomized approach is preferred over a deterministic one for a problem where the input distribution is unknown, and give one example problem where randomization helps. (3 marks)',
  },
  {
    questionId: 'A8', type: 'missing-constraint', severity: 'high',
    reason: 'A brute-force recovery of a 4-digit password is asked for without any constraint on the search space or attempt limit, so "an algorithm" could be 10,000 attempts or a single guess.',
    evidence: 'Write an algorithm for recovering the 4-digit numeric password',
    rewrite: 'A 4-digit numeric password is verified by a function check(p) that returns true only for the correct password. Write an algorithm that recovers the password by exhaustive search over all 4-digit strings, and state the maximum number of calls to check it makes. (3 marks)',
  },
  {
    questionId: 'B9', type: 'double-barreled', severity: 'medium',
    reason: 'Part a) asks for the backtracking strategy and its application to Sudoku, which are two separate answers, and the 5 marks do not say how they are split.',
    evidence: 'Explain how backtracking strategy can be applied to solve Sudoku problem?',
    rewrite: 'a) State the backtracking strategy in two or three sentences, then apply it to a 4x4 Sudoku by showing the state after the first two placements and the first point at which the algorithm backtracks. (5 marks)',
  },
  {
    questionId: 'B10', type: 'multiple-interpretations', severity: 'medium',
    reason: '"Apply Means-Ends Analysis to develop the software" has no stated goal state or operators, which are the two things the technique is defined by, so any narrative answer is acceptable.',
    evidence: 'How will you apply Means-Ends Analysis to develop the software?',
    rewrite: 'Apply Means-Ends Analysis to the goal "a campus management system where a student can register for a course". State the current state, the goal state, two operators, and the difference each operator reduces. (6 marks)',
  },
  {
    questionId: 'B11', type: 'missing-constraint', severity: 'high',
    reason: 'The grade bands overlap (60-70 and 50-69 both include neither 60 nor 69 cleanly against 70-79), and the "next multiple of 10" rule has no tie-break, so two correct pseudocodes can grade the same mark differently.',
    evidence: 'Marks 60-70: Grade D; Marks 50-69: Grade E',
    rewrite: 'Write pseudocode for a grading system using these bands: 90-100 A, 80-89 B, 70-79 C, 60-69 D, 50-59 E, below 50 F. Then apply this promotion rule: if the mark is within 3 below the next multiple of 10, raise it to the next band, except when the mark is below 50. Handle exactly 50 and exactly 90 explicitly. (6 marks)',
  },
  {
    questionId: 'B11', type: 'marks-effort-mismatch', severity: 'medium',
    reason: 'Part b) describes a long logistics scenario but the actual task, printing numbers divisible by 6 and not by 4, is a two-line loop that is worth less than the 3 marks it carries.',
    evidence: 'divisible by 6 ... but not divisible by 4',
    rewrite: 'b) Write an algorithm that reads a list of n delivery times and prints only those divisible by 6 but not by 4. Then state the time complexity of your algorithm and justify it. (3 marks)',
  },
  {
    questionId: 'B12', type: 'vague-wording', severity: 'medium',
    reason: '"Ensuring the solution is efficient for real-world applications" is not a measurable requirement, so efficiency cannot be marked either way.',
    evidence: 'ensuring the solution is efficient for real-world applications',
    rewrite: 'a) Write the pseudocode to find the largest and smallest numbers in a list of N numbers. State the number of comparisons your solution makes in the worst case, and explain why a single pass is or is not sufficient. (6 marks)',
  },
  {
    questionId: 'B13', type: 'missing-data', severity: 'medium',
    reason: 'Part b) does not state the tolerance for the right-triangle test, which matters for floating-point side lengths and for whether the sides are integers.',
    evidence: 'determine whether or not the triangle is a right triangle',
    rewrite: 'b) Write a program that reads the three side lengths of a triangle as floating-point numbers and decides whether it is right-angled, using a tolerance of 1e-9 when comparing a^2 + b^2 with c^2. Also report whether the three sides form a valid triangle at all. (4 marks)',
  },
  {
    questionId: 'B14', type: 'double-barreled', severity: 'medium',
    reason: 'Part b) asks for a classification rule, a rearrangement, and a single-word output, which is three asks inside 3 marks.',
    evidence: 'all capital letters to appear first, followed by small letters, then digits, and finally any special characters',
    rewrite: 'b) Write a Python function that takes a string and returns its characters rearranged as capitals, then small letters, then digits, then other characters, preserving the order within each group. Show the result for "Py3_th@on". (3 marks)',
  },
  {
    questionId: 'B15', type: 'figure-dependent', severity: 'low',
    reason: 'The question asks for a Divide and Conquer solution but the paper gives no array to work on, so the "suitable example" is entirely of the candidate\u2019s choosing.',
    evidence: 'Explain with a suitable example',
    rewrite: 'a) Given the array of loan interest rates [9.5, 7.25, 11.0, 8.4, 6.9, 10.2], find the sum of the two smallest rates using a Divide and Conquer approach. Show the split, the combine step, and the recurrence for the running time. (6 marks)',
  },
  {
    questionId: 'B16', type: 'missing-constraint', severity: 'medium',
    reason: 'The greedy task-scheduling problem never says whether tasks must be taken in the given order or may be sorted, and the two readings have different answers.',
    evidence: 'maximum number of tasks you can complete in a given total time limit',
    rewrite: 'b) Given an array of task durations and a total time limit T, determine the maximum number of tasks that can be completed. State whether tasks may be reordered; if they may, sort by duration ascending and justify why that greedy choice is optimal. (3 marks)',
  },
];

/** Alternative questions. `forTopic` finds a real uncovered topic by keyword. */
const AUTHORED_SUGGESTIONS = [
  { forTopic: 'Decomposition and Modularization', module: 3, co: 'CO3', bloom: 'K2', marks: 3, text: 'Define modularization and state two reasons why decomposing a problem into modules makes it easier to test.', rationale: 'Module 3 carries no marks for decomposition or modularization on this paper, and the topic is explicitly in the syllabus.' },
  { forTopic: 'Avoiding Circularity in Recursion', module: 3, co: 'CO3', bloom: 'K4', marks: 3, text: 'Explain why a recursive function without a base case that is guaranteed to be reached causes a stack overflow, using a two-line Python example to illustrate.', rationale: 'This topic carries zero marks even though it is the failure mode behind two of the paper\u2019s recursion questions.' },
  { forTopic: 'Functions with multiple return values', module: 3, co: 'CO3', bloom: 'K3', marks: 3, text: 'Write a Python function that takes a list of integers and returns both the smallest value and its index, in a single return statement.', rationale: 'Gives Module 3 a 3-mark apply-level question on a topic the paper never touches.' },
  { forTopic: 'Creating and using Arrays', module: 3, co: 'CO3', bloom: 'K3', marks: 3, text: 'Using the Numpy library, create an array of the first ten even numbers and print the count of values greater than 10.', rationale: 'Arrays via Numpy are in the syllabus and earn no marks on this paper.' },
  { forTopic: 'Modularization', module: 3, co: 'CO3', bloom: 'K2', marks: 3, text: 'Differentiate between problem decomposition and modularization, and state how each contributes to solving a complex problem.', rationale: 'A K2 comparison that closes the largest single gap in Module 3 coverage.' },
  { forTopic: 'case structure', module: 2, co: 'CO2', bloom: 'K3', marks: 3, text: 'Write pseudocode using a case structure to map a single-character grade (A, B, C, D, F) to its grade point, and state what your pseudocode does for any other character.', rationale: 'The paper asks for if-else pseudocode twice but never for the case structure that the syllabus lists alongside it.' },
  { forTopic: 'Recursion and the Stack', module: 3, co: 'CO3', bloom: 'K2', marks: 3, text: 'Sketch the call stack after three recursive calls of a factorial function with input 3, labelling each frame and its return value.', rationale: 'The paper tests writing recursive code but never the stack behaviour the syllabus pairs with it.' },
];

/** Per-question persona judgement. Bands and times come from the rubric below. */
const PERSONA_NOTES = {
  A1: {
    weak: ['Describes solving the puzzle in general terms with no systematic search, and never states what makes a placement "wrong".', 'trial and error method'],
    average: ['Lists a reasonable order of attempts but does not connect it to a stopping condition, so the answer reads as a story.', 'trial and error'],
    strong: ['Gives the systematic search but writes more than the 3 marks need and may omit the explicit criterion for discarding a piece.', 'trial and error method'],
  },
  A2: {
    weak: ['Writes isdigit() on the whole string without noticing the embedded space, so the snippet prints False and no reason is given.', '"1234 5"'],
    average: ['Notices the space and strips it, but does not say what the function returns for the original string.', 'check if it is numeric'],
    strong: ['Handles both readings and states the printed result, losing marks only if the method name is left out.', 'numeric'],
  },
  A3: {
    weak: ['Draws a flowchart with the right symbols but no initialisation and no loop exit, so it cannot terminate.', "generate the first 'n' numbers"],
    average: ['Produces a terminating flowchart but starts the sequence at 1, 1 instead of 0, 1.', 'Fibonacci sequence'],
    strong: ['Complete and correctly initialised; may lose a mark for omitting the n = 1 decision.', 'first \'n\' numbers'],
  },
  A4: {
    weak: ['Reverses the digits with string slicing but forgets the comparison step, giving a program that does not decide anything.', 'Palindrome or not'],
    average: ['Correct string-based reversal and comparison, but no handling of negative input or of single-digit numbers.', 'input integer'],
    strong: ['Correct, and usually adds the negative-number edge case unprompted.', 'Palindrome'],
  },
  A5: {
    weak: ['Answers (i) only, or gives the values without noticing that the step is negative in the first loop.', 'range(-10,-20,-2)'],
    average: ['Gets (i) and (ii) right but mis-evaluates the exponentiation order in (iii).', '2*3**2**2'],
    strong: ['All three correct, including right-to-left exponentiation, in well under the time available.', '2*3**2**2'],
  },
  A6: {
    weak: ['Loops correctly but tests x % 2 == 1 for odd instead of == 0 for even, inverting the result.', 'sum of even numbers'],
    average: ['Correct sum, but assumes the numbers are already in a list rather than reading N of them.', 'N given numbers'],
    strong: ['Correct and typically also handles negatives and zero.', 'even numbers'],
  },
  A7: {
    weak: ['Gives a single vague sentence about randomness being "sometimes faster".', 'motivation for using a randomized approach'],
    average: ['Gives one defensible reason but no example problem.', 'randomized approach'],
    strong: ['Gives two reasons with an example, and may add unnecessary detail on Monte Carlo methods.', 'motivation'],
  },
  A8: {
    weak: ['States that all 10,000 passwords should be tried but gives no loop structure or termination condition.', 'recovering the 4-digit numeric password'],
    average: ['Gives a nested-loop brute force up to 9999 but mishandles leading zeros, so 0000 to 0999 are skipped.', '4-digit numeric password'],
    strong: ['Correct exhaustive search from 0000 to 9999 with the attempt bound stated; may over-explain.', 'recovering the 4-digit'],
  },
  B9: {
    weak: ['Describes Sudoku rules rather than the backtracking strategy, and does not attempt part b) at all.', 'backtracking strategy can be applied'],
    average: ['Explains backtracking acceptably but gives a generic "choose the best restaurant" answer for heuristics without defining a heuristic function.', 'heuristics approach'],
    strong: ['Both parts answered with a concrete heuristic (rating, distance); may spend too long on the Sudoku example relative to 5 marks.', 'heuristics approach'],
  },
  B10: {
    weak: ['Writes a paragraph about campus software with no mention of a goal state or an operator.', 'Means-Ends Analysis'],
    average: ['Names the current state and goal state but not the difference-reduction operators, which is the core of the technique.', 'apply Means-Ends Analysis'],
    strong: ['States current state, goal state and operators; loses marks only if the difference reduced by each operator is left implicit.', 'Means-Ends Analysis'],
  },
  B11: {
    weak: ['Writes a nested if-else that covers most bands but silently drops the promotion rule, and leaves part b) incomplete.', 'next multiple of 10'],
    average: ['Correct bands and a working promotion rule, but does not notice that 60 and 70 fall in two bands as printed, so the boundary behaviour is undefined.', 'Marks 60-70: Grade D'],
    strong: ['Handles the overlapping bands by choosing an interpretation and stating it, and completes both parts inside the time.', 'less that 3'],
  },
  B12: {
    weak: ['Writes pseudocode that initialises largest and smallest both to 0, so a list of positive numbers returns 0 as the smallest.', 'largest and smallest numbers'],
    average: ['Correct initialisation from the first element, but does not address the efficiency claim at all.', 'efficient for real-world applications'],
    strong: ['Correct single-pass pseudocode with the comparison count stated.', 'efficient for real-world'],
  },
  B13: {
    weak: ['Writes an iterative Fibonacci loop despite the instruction to use recursion, or omits the base case.', 'use recursion to solve it'],
    average: ['Correct recursive Fibonacci but no base-case discussion, and the triangle test uses exact equality on floating-point values.', 'right triangle'],
    strong: ['Correct recursion with base cases, and uses a tolerance in the triangle test; may not state the tolerance value.', 'right triangle'],
  },
  B14: {
    weak: ['Attempts the LCM with a loop but ignores the GCD relationship that the question requires, or leaves part b) blank.', 'relationship between GCD and LCM'],
    average: ['Uses gcd from the math module and the product relationship correctly, but the character reordering in b) is written as three separate prints rather than one word.', 'capital letters to appear first'],
    strong: ['Both parts correct, including stable ordering within each character group; may lose a mark for not stating the complexity.', 'single word'],
  },
  B15: {
    weak: ['Sorts the array and takes the two smallest, which contradicts the Divide and Conquer requirement, or leaves part a) as a plan with no example.', 'Divide and Conquer approach'],
    average: ['Describes splitting and merging correctly but the example is trivial and the comparison with part b) is a list of one-line differences.', 'sum of the two smallest rates'],
    strong: ['Correct divide-and-conquer with a worked example on the given data; may under-spend on part b) which is only 3 marks.', 'Divide and Conquer'],
  },
  B16: {
    weak: ['Defines memoization and tabulation but confuses which one is top-down, and does not attempt the greedy part.', 'memoization and tabulation'],
    average: ['Correct definitions, but the greedy scheduling answer sorts descending and takes the longest tasks first, which is the wrong greedy choice.', 'maximum number of tasks'],
    strong: ['Correct on both, with the exchange argument for sorting ascending; may not have time to write the reasoning out fully.', 'maximum number of tasks'],
  },
};

/**
 * Band and time rubric.
 *
 * Bands follow from the assessed Bloom level of the question and the persona's
 * calibration; times follow from the marks, inflated or deflated per persona.
 * This is a rubric, not a model, and is labelled as such in the bundle.
 */
const BLOOM_BY_QUESTION = {
  A1: 'K2', A2: 'K3', A3: 'K3', A4: 'K3', A5: 'K2', A6: 'K3', A7: 'K2', A8: 'K3',
  B9: 'K2', B10: 'K3', B11: 'K3', B12: 'K3', B13: 'K3', B14: 'K3', B15: 'K4', B16: 'K4',
};

/**
 * Per-question persona bands: [weak lo, weak hi, avg lo, avg hi, strong lo, strong hi].
 *
 * These override the Bloom-level rubric below, because a pure rubric makes every
 * question look like a good separator. Real papers are not like that: some
 * questions are hard for everyone (B11, whose printed grade bands contradict
 * each other) and some are easy for everyone (A7, a one-line recall answer).
 * Those are exactly the cases Mode B is supposed to surface.
 */
const BANDS = {
  A1: [10, 40, 35, 65, 60, 90], // open-ended, discriminates well
  A2: [5, 40, 30, 62, 42, 66], // ambiguous, so the strong persona is held back too
  A3: [5, 35, 40, 70, 70, 95],
  A4: [15, 50, 42, 72, 55, 78],
  A5: [10, 45, 40, 75, 70, 95],
  A6: [10, 40, 40, 75, 75, 95],
  A7: [60, 95, 75, 100, 90, 100], // easy for everyone: a one-line recall answer
  A8: [0, 25, 25, 55, 55, 85],
  B9: [15, 45, 45, 75, 50, 75], // medium separation
  B10: [5, 35, 40, 70, 70, 95],
  B11: [0, 12, 3, 20, 10, 25], // hard for everyone: the printed bands overlap
  B12: [15, 50, 42, 72, 55, 78],
  B13: [5, 35, 40, 70, 70, 95],
  B14: [0, 25, 30, 60, 60, 85],
  B15: [0, 15, 15, 40, 40, 70],
  B16: [0, 20, 20, 50, 45, 80],
};

const BAND_RUBRIC = {
  // Fallback only, for questions with no entry above.
  K1: [40, 90, 70, 100, 90, 100],
  K2: [15, 60, 55, 85, 80, 100],
  K3: [5, 45, 45, 80, 75, 100],
  K4: [0, 30, 30, 65, 65, 95],
  K5: [0, 25, 25, 60, 60, 90],
  K6: [0, 20, 20, 55, 55, 90],
};

const TIME_FACTOR = { weak: 1.72, average: 1.12, strong: 0.86 };

const TIME_BY_MARKS = { 3: 4.5, 5: 7.5, 6: 8.5, 9: 12 };

/* --------------------------------------------------------------- build */

const topicIndex = new Map(); // `${module}` -> [{id, text}]

function findTopicIds(module, keywords) {
  const topics = topicIndex.get(module) ?? [];
  const ids = [];
  for (const keyword of keywords) {
    const needle = keyword.toLowerCase();
    const hit = topics.find((t) => t.text.toLowerCase().includes(needle));
    if (hit && !ids.includes(hit.id)) ids.push(hit.id);
  }
  return ids;
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });

  const index = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'ktu-2024-index.json'), 'utf8'));
  const course = index.courses.find((c) => c.code === 'UCEST105') ?? index.courses[0];
  const syllabus = syllabusFromIndexCourse(course);

  for (const m of syllabus.modules) {
    topicIndex.set(m.number, m.topics.map((t) => ({ id: t.id, text: t.text })));
  }

  const scope = {
    courseCode: 'UCEST105',
    courseTitle: 'Algorithmic Thinking with Python',
    examLabel: 'First Semester B.Tech Degree Regular Examination December 2024 (2024 Scheme)',
    totalMarks: 60,
    durationMinutes: 150,
    modulesInScope: [1, 2, 3],
    moduleScopeNotes:
      'The teacher declared Modules 1-3 examinable and Module 4 out of scope, so this demo can show the out-of-scope and uncovered-topic checks working on a real paper.',
    paperStructure: {
      source: 'teacher',
      note: `${KTU_2024_DEFAULT_PATTERN.note} (Confirmed by the teacher.)`,
      parts: KTU_2024_DEFAULT_PATTERN.parts,
    },
    classNote: 'This batch is weak at recursion and at reading pseudocode for boundary conditions.',
    unresolved: [],
  };

  /* --- segmentation --------------------------------------------------- */
  const segmentation = {
    courseCode: 'UCEST105',
    courseTitle: 'ALGORITHMIC THINKING WITH PYTHON',
    examLabel: scope.examLabel,
    totalMarksPrinted: 60,
    durationMinutes: 150,
    parts: [
      { name: 'Part A', instructions: 'Answer all questions. Each question carries 3 marks.', questionCount: 8, marksPerQuestion: 3, totalMarks: 24, choice: 'none', coversModules: [1, 2, 3, 4] },
      { name: 'Part B', instructions: 'Answer any one full question from each module, each question carries 9 marks.', questionCount: 8, marksPerQuestion: 9, totalMarks: 36, choice: 'either-or', coversModules: [1, 2, 3, 4] },
    ],
    questions: QUESTIONS.map((q) => ({
      id: q.id,
      part: q.part,
      label: q.label,
      text: q.text,
      marks: q.marks,
      marksSource: 'printed',
      subParts: q.subParts ?? [],
      choiceGroup: q.choiceGroup ?? '',
      moduleLabel: q.moduleLabel ?? '',
      printedCo: q.co ? `CO-${q.co.slice(2)}` : '',
      hasFigure: false,
      notes: q.note ?? '',
    })),
    totalMarksCounted: 60,
    warnings: [
      'Part B prints 8 questions of 9 marks (72 marks) but only four are answered, so 60 is the answerable total. Either/or pairs are counted once throughout.',
      'Question 11 b) carries no CO tag in the printed paper; CO2 is taken from its module.',
    ],
  };

  /* --- deterministic coverage from the real printed module and CO tags -- */
  const assignmentsById = new Map();
  for (const q of QUESTIONS) {
    assignmentsById.set(q.id, {
      questionId: q.id,
      modules: [q.module],
      topicIds: findTopicIds(q.module, q.topics),
      cos: [q.co],
      assessedBloom: BLOOM_BY_QUESTION[q.id],
      inScope: scope.modulesInScope.includes(q.module),
      confidence: 'high',
      why: `Printed as ${q.moduleLabel || 'Part A'} question ${q.label} with CO tag ${q.co}.`,
    });
  }

  const reference = buildReference({ syllabus, scope });
  const coverage = computeCoverage({
    questions: segmentation.questions.map((q) => ({ ...q, choiceGroup: q.choiceGroup })),
    assignmentsById,
    reference,
    scope,
  });
  const bloomCheck = computeBloomCheck(coverage, reference);
  const hotspots = computeHotspots(coverage);

  /* --- flags ---------------------------------------------------------- */
  const flags = [];
  for (const authored of AUTHORED_FLAGS) {
    flags.push({ id: `F-${authored.questionId}-${authored.type}`, ...authored });
  }
  for (const q of coverage.outOfScopeQuestions) {
    flags.push({
      id: `derived-oos-${q.id}`, questionId: q.id, type: 'out-of-scope', severity: 'high',
      reason: q.why, evidence: '', rewrite: '', derived: true,
    });
  }
  for (const t of coverage.uncoveredTopics) {
    flags.push({
      id: `derived-unc-${t.topicId}`, questionId: '', topicId: t.topicId, type: 'uncovered-topic',
      severity: 'medium', reason: `In-scope topic "${t.topic}" (Module ${t.module}) carries no marks on this paper.`,
      evidence: '', rewrite: '', derived: true,
    });
  }
  for (const h of hotspots) {
    flags.push({
      id: `derived-hot-${h.module}`, questionId: '', module: h.module, type: 'over-weighted-topic',
      severity: Math.abs(h.delta) >= 15 ? 'high' : 'medium',
      reason: `Module ${h.module} carries ${h.observedPercent}% of the answerable marks against an expected ${h.expectedPercent}%.`,
      evidence: '', rewrite: '', derived: true,
    });
  }
  for (const b of bloomCheck.mismatches) {
    flags.push({
      id: `derived-bloom-${b.questionId}`, questionId: b.questionId, type: 'bloom-mismatch', severity: 'low',
      reason: `Assessed at ${b.assessed} but its ${b.co} outcome is at ${b.coBloom}.`, evidence: '', rewrite: '', derived: true,
    });
  }

  const duplicates = [
    { questionIds: ['B11', 'B12'], severity: 'medium', reason: 'Both part a) answers are pseudocode for a conditional over a list, and both part b) answers are a short pseudocode loop. Candidates can reuse the same structure twice for 18 marks.' },
    { questionIds: ['B9', 'B10'], severity: 'low', reason: 'Both begin by naming a problem-solving strategy and then asking for its application to a supplied scenario. The second is largely a re-test of the first.' },
    { questionIds: ['A3', 'B13'], severity: 'medium', reason: 'The Fibonacci sequence is the subject of a Part A flowchart and again of a Part B recursive program, so one topic carries 12 marks.' },
  ];

  /* --- suggestions, keyed to real uncovered topics ---------------------- */
  const uncoveredByKeyword = coverage.uncoveredTopics.map((t) => ({ ...t, lower: t.topic.toLowerCase() }));
  const suggestions = [];
  for (const wanted of AUTHORED_SUGGESTIONS) {
    const needle = wanted.forTopic.toLowerCase();
    const match = uncoveredByKeyword.find((t) => t.lower.includes(needle));
    if (!match) continue;
    suggestions.push({
      coversTopicId: match.topicId,
      module: match.module,
      co: wanted.co,
      bloom: wanted.bloom,
      marks: wanted.marks,
      text: wanted.text,
      rationale: `${wanted.rationale} Closes the coverage gap on topic ${match.topicId}.`,
    });
  }
  // Two replacements for the most serious authored flags.
  for (const questionId of ['A2', 'B11']) {
    const flag = flags.find((f) => f.questionId === questionId && f.rewrite);
    if (!flag) continue;
    suggestions.push({
      replacesQuestionId: questionId,
      module: QUESTIONS.find((q) => q.id === questionId).module,
      co: QUESTIONS.find((q) => q.id === questionId).co,
      bloom: BLOOM_BY_QUESTION[questionId],
      marks: QUESTIONS.find((q) => q.id === questionId).marks,
      text: flag.rewrite,
      rationale: `Drop-in replacement fixing the ambiguity flagged on ${questionId}.`,
    });
  }

  const highCount = flags.filter((f) => f.severity === 'high').length;
  const analysis = {
    mode: 'analysis',
    generatedAt: GENERATED_AT,
    promptVersion: PROMPT_VERSION,
    model: 'cached demo bundle',
    scope,
    syllabusMeta: {
      courseCode: syllabus.courseCode,
      courseTitle: syllabus.courseTitle,
      sourceUrl: syllabus.sourceUrl,
      sourceKind: 'bundled-index',
      moduleCount: reference.modules.length,
      coCount: reference.courseOutcomes.length,
    },
    coverage,
    bloomCheck,
    hotspots,
    flags,
    duplicates,
    suggestions,
    summary: {
      headline: `${coverage.outOfScopeQuestions.length} questions sit outside the scope you declared, and ${coverage.uncoveredTopics.length} in-scope topics earn no marks.`,
      verdict: 'needs-rework',
      strengths: [
        'Every question carries a printed CO tag, so the paper is well traced to its outcomes.',
        'The Part A / Part B split matches the 2024-scheme pattern exactly: 8 x 3 plus 4 x 9, with either/or choices only in Part B.',
        'Scenario-based framing in Part B gives candidates a realistic context rather than a bare recall prompt.',
      ],
      risks: [
        `Questions ${coverage.outOfScopeQuestions.map((q) => q.label ?? q.id).join(', ')} assess Module 4, which you declared out of scope, so they will be unanswerable for a class taught only Modules 1-3.`,
        `${coverage.uncoveredTopics.length} in-scope topics, including recursion on the call stack and modularization, carry no marks at all, so strong candidates get no credit for knowing them.`,
        'Question 11 a) prints overlapping grade bands (60-70 and 50-69), which will make marking inconsistent.',
        'Several 3-mark questions ask for three separate outputs or for work that needs far more than three marks of effort.',
      ],
      actions: [
        'Either widen the scope to include Module 4, or replace questions 7, 8, 15 and 16 with Module 1-3 questions.',
        'Accept the proposed replacements for questions A2 and B11 a) to remove the two highest-risk ambiguities.',
        'Add one 3-mark question on recursion and the call stack, and one on modularization, to close the largest gaps in Module 3.',
        'Fix the printed grade bands in question 11 a) before the paper goes to print; the overlap is a marking problem, not a wording preference.',
      ],
    },
    stats: { llmCalls: 0, attempts: 0, repairs: 0, note: 'Cached demo bundle: no model call was made.' },
    warnings: [
      'This is the bundled demo bundle, generated from the real paper and the real 2024-scheme syllabus. Coverage, Bloom comparison, hotspots and persona arithmetic were computed by Paperguide, not by a model.',
      `The scope deliberately excludes Module 4 so the out-of-scope and uncovered-topic checks are visible. ${highCount} high-severity flags.`,
    ],
  };

  /* --- persona --------------------------------------------------------- */
  const personaReportQuestions = [];
  const predictions = new Map();
  for (const q of QUESTIONS) {
    const bloom = BLOOM_BY_QUESTION[q.id];
    const rubric = BANDS[q.id] ?? BAND_RUBRIC[bloom];
    const notes = PERSONA_NOTES[q.id];
    const perQuestion = [];
    const personaKeys = ['weak', 'average', 'strong'];
    personaKeys.forEach((persona, index) => {
      const low = rubric[index * 2];
      const high = rubric[index * 2 + 1];
      const midpoint = Math.round(((low + high) / 2) * 10) / 10;
      const [pitfall, trigger] = notes[persona];
      const baseTime = TIME_BY_MARKS[q.marks] ?? q.marks * 1.4;
      const timeMinutes = Math.round(baseTime * TIME_FACTOR[persona] * 10) / 10;
      perQuestion.push({
        persona,
        bandLowPercent: low,
        bandHighPercent: high,
        likelyScorePercent: midpoint,
        pitfall,
        trigger,
        triggerQuote: trigger,
        timeMinutes,
        confidence: q.marks === 3 ? 'medium' : 'high',
        attemptsIt: !(persona === 'weak' && (q.id === 'B11' || q.id === 'B14')),
      });
    });
    predictions.set(q.id, { questionId: q.id, personas: perQuestion });
  }

  const aggregated = aggregatePersonas({
    questions: segmentation.questions.map((q) => ({ ...q })),
    predictions,
    scope,
    durationMinutes: scope.durationMinutes,
  });
  personaReportQuestions.push(...aggregated.perQuestion);

  const persona = {
    mode: 'persona',
    generatedAt: GENERATED_AT,
    promptVersion: PROMPT_VERSION,
    model: 'cached demo bundle',
    scope,
    syllabusMeta: {
      courseCode: syllabus.courseCode,
      courseTitle: syllabus.courseTitle,
      sourceUrl: syllabus.sourceUrl,
      sourceKind: 'bundled-index',
    },
    personas: PERSONAS,
    classNote: scope.classNote,
    perQuestion: aggregated.perQuestion,
    byPersona: aggregated.byPersona,
    examMax: aggregated.examMax,
    timeFeasibility: {
      ...aggregated.timeFeasibility,
      modelVerdict: aggregated.timeFeasibility.verdict,
      note: `With the stated class note applied, the weak persona is the binding constraint: the sum of their per-question times is ${
        aggregated.timeFeasibility.perPersona.find((p) => p.persona === 'weak')?.minutes
      } minutes against a ${scope.durationMinutes}-minute paper.`,
    },
    separation: aggregated.separation,
    overallSpread: [
      { persona: 'weak', expectedPercentLow: 18, expectedPercentHigh: 34, rationale: 'Scores come almost entirely from Part A and from the standard-method parts of B10 and B13; the Module 4 questions are unanswerable, which alone costs 30 printed marks of the paper.' },
      { persona: 'average', expectedPercentLow: 42, expectedPercentHigh: 58, rationale: 'Handles the Part A short answers and the routine pseudocode, but loses the justification and interpretation marks on B11 a), B12 a) and B14.' },
      { persona: 'strong', expectedPercentLow: 68, expectedPercentHigh: 84, rationale: 'Completes everything except the ambiguous questions, where their interpretation may differ from the examiner\u2019s, and loses careless marks on the 3-mark Part A items.' },
    ],
    rewritePriority: [
      { questionId: 'B11', label: '11', priority: 'high', why: 'The printed grade bands overlap, so two correct pseudocode answers can grade the same mark differently. This is the single biggest marking risk on the paper.', suggestedChange: 'Replace the bands with non-overlapping ranges and state the behaviour at exactly 50 and 90.' },
      { questionId: 'A2', label: '2', priority: 'high', why: 'The embedded space in the sample input makes "numeric" genuinely ambiguous, and a correct answer can be marked wrong.', suggestedChange: 'Say explicitly whether the whole string or each token is being tested.' },
      { questionId: 'A8', label: '8', priority: 'medium', why: 'Asks for password recovery with no stated constraint on the search space or attempt limit, so weak candidates write an unbounded search and strong candidates write a bound nobody asked for.', suggestedChange: 'State that a check function exists and ask for the maximum number of calls.' },
      { questionId: 'A5', label: '5', priority: 'medium', why: 'Three separate traces for 3 marks makes the time cost of this question disproportionate to its weight.', suggestedChange: 'Either raise the marks or reduce to two traces.' },
      { questionId: 'B16', label: '16', priority: 'low', why: 'The greedy scheduling part does not say whether tasks may be reordered, and the two readings have different answers.', suggestedChange: 'State whether reordering is permitted.' },
    ],
    summary: `The paper behaves predictably for the average and strong personas but not for the weak one, and the gap is largely structural rather than cognitive: the Module 4 questions are unanswerable under the declared scope, so the weak persona's ceiling is set by the scope rather than by difficulty. Question 11 a) is the clearest marking hazard. The 150-minute budget is workable for average and strong candidates and tight for weak candidates.`,
    modelSeparators: aggregated.separation.separators.map((s) => ({ questionId: s.questionId, separation: 'high', why: s.why })),
    stats: { llmCalls: 0, attempts: 0, repairs: 0, note: 'Cached demo bundle: no model call was made.' },
    warnings: [
      'Cached demo bundle. Bands come from a documented rubric over the question\u2019s assessed Bloom level and marks, not from a model run.',
      'All values are risk flags and relative difficulty estimates, not measured results.',
    ],
  };

  const manifest = {
    papers: [
      {
        id: 'UCEST105',
        title: 'Algorithmic Thinking with Python',
        courseCode: 'UCEST105',
        scheme: 'KTU 2024',
        semester: 1,
        examLabel: scope.examLabel,
        scenario: 'Modules 1-3 in scope, Module 4 deliberately excluded',
        source:
          'Real UCEST105 December 2024 paper (2024 scheme), transcribed verbatim in demo/sample-paper-raw.md; syllabus from data/ktu-2024-index.json',
        files: {
          paperText: 'UCEST105/paper.txt',
          scope: 'UCEST105/scope.json',
          syllabus: 'UCEST105/syllabus.json',
          segmentation: 'UCEST105/segmentation.json',
          analysis: 'UCEST105/analysis.json',
          persona: 'UCEST105/persona.json',
        },
        highlights: [
          `Out-of-scope questions ${coverage.outOfScopeQuestions.map((q) => q.label ?? q.id).join(', ')} all assess Module 4, which the teacher declared out of scope.`,
          `${coverage.uncoveredTopics.length} in-scope topics earn zero marks, including recursion on the call stack, modularization and Numpy arrays.`,
          `Module ${coverage.byModule.map((m) => `${m.module}=${m.percent}%`).join(', ')} - the answerable mark share per module.`,
          'Question 11 a) prints overlapping grade bands, flagged as a marking hazard with a concrete rewrite.',
          `Persona timing: ${aggregated.timeFeasibility.perPersona.map((p) => `${p.persona} ${p.minutes}m (${p.verdict})`).join(', ')} against a 150-minute paper.`,
        ],
      },
    ],
  };

  const write = (file, data) =>
    fs.writeFile(path.join(OUT, file), typeof data === 'string' ? data : `${JSON.stringify(data, null, 2)}\n`, 'utf8');

  await Promise.all([
    write('paper.txt', PAPER_TEXT),
    write('scope.json', scope),
    write('syllabus.json', syllabus),
    write('segmentation.json', segmentation),
    write('analysis.json', analysis),
    write('persona.json', persona),
    fs.writeFile(path.join(ROOT, 'public', 'demo', 'index.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
  ]);

  const totals = coverage.totals;
  console.log('Demo bundle written to public/demo/');
  console.log(`  answerable marks      : ${totals.answerableMarks} (printed ${totals.printedMarks})`);
  console.log(`  module shares         : ${coverage.byModule.map((m) => `M${m.module} ${m.percent}%`).join(', ')}`);
  console.log(`  out-of-scope questions: ${coverage.outOfScopeQuestions.map((q) => q.label).join(', ') || 'none'}`);
  console.log(`  uncovered in-scope    : ${coverage.uncoveredTopics.length}`);
  console.log(`  flags                 : ${flags.length} (${highCount} high)`);
  console.log(`  suggestions           : ${suggestions.length}`);
  console.log(`  persona marks         : ${aggregated.byPersona.map((p) => `${p.persona} ${p.expectedMarks}/${aggregated.examMax}`).join(', ')}`);
  console.log(`  persona time          : ${aggregated.timeFeasibility.perPersona.map((p) => `${p.persona} ${p.minutes}m ${p.verdict}`).join(', ')}`);
}

main().catch((err) => {
  console.error('build-demo failed:', err);
  process.exitCode = 1;
});
