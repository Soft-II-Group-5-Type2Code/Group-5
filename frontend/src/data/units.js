export const UNITS = [
  {
    id: 1,
    title: 'Functions',
    subtitle: '',
    showKeyboard: true,
    lessons: [
      {
        stepId: 1,
        backendLessonId: '8b8fa262-d683-4f9c-a20d-793b1d25b557',
        label: 'Build a function (adaptive)',
        learnText:
          'Start with the function keyword, then build real JavaScript functions one step at a time.',
        targetsByTier: {
          1: [
            'function hello() {',
            '  return "Hello";',
            '}',
            'hello();',

            'function greet() {',
            '  return "Hi";',
            '}',
            'greet();',

            'function run() {',
            '  return 1;',
            '}',
            'run();',

            'function code() {',
            '  return "Code";',
            '}',
            'code();',

            'function start() {',
            '  return "Start";',
            '}',
            'start();',
          ],
          2: [
            'function greet(name) {',
            '  return "Hi " + name;',
            '}',
            'greet("World");',

            'function hello(user) {',
            '  return "Hello " + user;',
            '}',
            'hello("Rustic");',

            'function double(n) {',
            '  return n + n;',
            '}',
            'double(5);',

            'function add(a, b) {',
            '  return a + b;',
            '}',
            'add(1, 2);',

            'function getName() {',
            '  return "Logan";',
            '}',
            'getName();',

            'function print(msg) {',
            '  return msg;',
            '}',
            'print("Code");',
          ],
          3: [
            'function greet(name) {',
            '  return "Hi " + name;',
            '}',
            'greet("World");',
            'greet("Rustic");',

            'function add(a, b) {',
            '  return a + b;',
            '}',
            'add(1, 2);',
            'add(3, 4);',

            'function double(n) {',
            '  return n + n;',
            '}',
            'double(5);',
            'double(10);',

            'function hello(user) {',
            '  return "Hello " + user;',
            '}',
            'hello("Logan");',
            'hello("Rustic");',

            'function getName() {',
            '  return "Logan";',
            '}',
            'getName();',
            'getName();',

            'function print(msg) {',
            '  return msg;',
            '}',
            'print("Go");',
          ],
        },
        tierRules: {
          minTier: 1,
          maxTier: 3,
          promoteIf: { wpm: 28, accuracy: 0.95, streak: 2 },
          demoteIf: { wpm: 14, accuracy: 0.85, streak: 2 },
        },
      },
    ],
    finalChallenge: {
      label: 'Final Challenge',
      language: 'javascript',
      prompt:
        'Write a function named greet that takes a parameter called name and returns "Hello " + name. Call greet with the argument "World" and log the result with console.log.',
      starterCode: '// Write your code here\n',
      expectedOutput: 'Hello World',
    },
  },

  {
    id: 2,
    title: 'Variables',
    subtitle: '',
    showKeyboard: true,
    lessons: [
      {
        stepId: 1,
        backendLessonId: '1ea1251b-bb01-4bf0-9484-28aff13dc59e',
        label: 'Variables in JavaScript (adaptive)',
        learnText:
          'Build variable declarations into real JavaScript snippets — numbers, strings, and updates.',
        targetsByTier: {
          1: [
            'let score = 0;',
            'score = score + 1;',
            'let name = "Rustic";',
            'let level = 1;',

            'let lives = 3;',
            'lives = lives - 1;',
            'let mode = "easy";',
            'let points = 10;',

            'let player = "Logan";',
            'let health = 100;',
            'health = health - 10;',
            'let stage = 1;',

            'const maxLives = 3;',
            'let remaining = maxLives;',
            'remaining = remaining - 1;',
            'let status = "active";',

            'let count = 0;',
            'count = count + 1;',
            'count = count + 1;',
            'count = count + 1;',
          ],
          2: [
            'let score = 0;',
            'score = score + 1;',
            'score = score + 1;',
            'console.log(score);',

            'let lives = 3;',
            'lives = lives - 1;',
            'lives = lives - 1;',
            'console.log(lives);',

            'const bonus = 5;',
            'let points = 10;',
            'points = points + bonus;',
            'console.log(points);',

            'let player = "Logan";',
            'let level = 1;',
            'level = level + 1;',
            'console.log(level);',

            'let count = 0;',
            'count = count + 1;',
            'count = count + 1;',
            'count = count + 1;',
            'console.log(count);',

            'const maxScore = 100;',
            'let current = 0;',
            'current = current + 10;',
            'console.log(current);',
          ],
          3: [
            'const maxLives = 3;',
            'let lives = maxLives;',
            'lives = lives - 1;',
            'console.log(lives);',

            'let score = 0;',
            'score = score + 10;',
            'score = score + 10;',
            'score = score + 10;',
            'console.log(score);',

            'let username = "Rustic";',
            'let level = 1;',
            'level = level + 1;',
            'level = level + 1;',
            'console.log(level);',

            'const bonus = 5;',
            'let points = 0;',
            'points = points + bonus;',
            'points = points + bonus;',
            'console.log(points);',

            'let player = "Logan";',
            'let health = 100;',
            'health = health - 25;',
            'health = health - 25;',
            'console.log(health);',

            'let count = 0;',
            'count = count + 1;',
            'count = count + 1;',
            'console.log(count);',
          ],
        },
        tierRules: {
          minTier: 1,
          maxTier: 3,
          promoteIf: { wpm: 28, accuracy: 0.95, streak: 2 },
          demoteIf: { wpm: 14, accuracy: 0.85, streak: 2 },
        },
      },
    ],
    finalChallenge: {
      label: 'Final Challenge',
      language: 'javascript',
      prompt:
        'Declare a variable score starting at 0. Add 3 to it, then log your updated score with console.log.',
      starterCode: '// Write your code here\n',
      expectedOutput: '3',
    },
  },

  {
    id: 3,
    title: 'If Statements',
    subtitle: '',
    showKeyboard: true,
    lessons: [
      {
        stepId: 1,
        backendLessonId: '61af8e09-7372-4fac-8688-816db04e99c6',
        label: 'If statements (adaptive)',
        learnText:
          'Start with simple if syntax, add bodies, then branch between two outcomes with else.',
        targetsByTier: {
          1: [
            'if (score >= 10) {',
            '  console.log("win");',
            '}',

            'if (lives > 0) {',
            '  console.log("keep going");',
            '}',

            'if (mode === "easy") {',
            '  console.log("easy mode");',
            '}',

            'if (ready === true) {',
            '  console.log("ready");',
            '}',

            'if (score >= 10) {',
            '  console.log("win");',
            '} else {',
            '  console.log("try again");',
            '}',

            'if (lives > 0) {',
            '  console.log("keep going");',
            '} else {',
            '  console.log("game over");',
            '}',

            'if (mode === "easy") {',
            '  console.log("easy mode");',
            '} else {',
            '  console.log("hard mode");',
            '}',
          ],
          2: [
            'let score = 9;',
            'if (score >= 10) {',
            '  console.log("win");',
            '} else {',
            '  console.log("try again");',
            '}',

            'let lives = 0;',
            'if (lives > 0) {',
            '  console.log("keep going");',
            '} else {',
            '  console.log("game over");',
            '}',

            'let mode = "easy";',
            'if (mode === "easy") {',
            '  console.log("easy mode");',
            '} else {',
            '  console.log("hard mode");',
            '}',

            'let ready = true;',
            'if (ready === true) {',
            '  console.log("start");',
            '} else {',
            '  console.log("wait");',
            '}',
          ],
          3: [
            'let score = 9;',
            'let lives = 3;',
            'if (score >= 10) {',
            '  console.log("win");',
            '} else {',
            '  console.log("try again");',
            '}',

            'let mode = "easy";',
            'let ready = true;',
            'if (ready === true) {',
            '  console.log("start");',
            '} else {',
            '  console.log("wait");',
            '}',

            'let username = "Rustic";',
            'let points = 15;',
            'if (points >= 10) {',
            '  console.log("high score");',
            '} else {',
            '  console.log("keep going");',
            '}',

            'let health = 0;',
            'let level = 3;',
            'if (health > 0) {',
            '  console.log("alive");',
            '} else {',
            '  console.log("game over");',
            '}',
          ],
        },
        tierRules: {
          minTier: 1,
          maxTier: 3,
          promoteIf: { wpm: 28, accuracy: 0.95, streak: 2 },
          demoteIf: { wpm: 14, accuracy: 0.85, streak: 2 },
        },
      },
    ],
    finalChallenge: {
      label: 'Final Challenge',
      language: 'javascript',
      prompt:
        'Declare a variable score and set it to 15. Write an if/else statement: if score is greater than or equal to 10, log "You win!" — otherwise log "Try again".',
      starterCode: '// Write your code here\n',
      expectedOutput: 'You win!',
    },
  },

  {
    id: 4,
    title: 'Loops (for)',
    subtitle: '',
    showKeyboard: true,
    lessons: [
      {
        stepId: 1,
        backendLessonId: '127db732-8cad-4152-8edf-0ea67d17be20',
        label: 'For loops (adaptive)',
        learnText:
          'Learn the shape of a for loop, then grow into full loop bodies with variables.',
        targetsByTier: {
          1: [
            'for (let i = 0; i < 5; i = i + 1) {',
            '  console.log(i);',
            '}',

            'for (let x = 0; x < 3; x = x + 1) {',
            '  console.log(x);',
            '}',

            'let score = 0;',
            'for (let i = 0; i < 5; i = i + 1) {',
            '  score = score + 1;',
            '}',

            'let lives = 3;',
            'for (let x = 0; x < 3; x = x + 1) {',
            '  lives = lives - 1;',
            '}',

            'let points = 0;',
            'for (let i = 0; i < 4; i = i + 1) {',
            '  points = points + 5;',
            '}',
            'console.log(points);',

            'console.log(score);',
          ],
          2: [
            'let score = 0;',
            'for (let i = 0; i < 5; i = i + 1) {',
            '  score = score + 1;',
            '  console.log(score);',
            '}',

            'let lives = 3;',
            'for (let x = 0; x < 3; x = x + 1) {',
            '  lives = lives - 1;',
            '  console.log(lives);',
            '}',

            'let points = 10;',
            'for (let i = 0; i < 3; i = i + 1) {',
            '  points = points + 5;',
            '  console.log(points);',
            '}',

            'let count = 0;',
            'for (let n = 0; n < 4; n = n + 1) {',
            '  count = count + 1;',
            '}',
            'console.log(count);',

            'let total = 0;',
            'for (let i = 0; i < 5; i = i + 1) {',
            '  total = total + 2;',
            '}',
          ],
          3: [
            'let score = 0;',
            'for (let i = 0; i < 5; i = i + 1) {',
            '  score = score + 1;',
            '  console.log(score);',
            '}',
            'console.log(score);',

            'let lives = 3;',
            'for (let x = 0; x < 3; x = x + 1) {',
            '  lives = lives - 1;',
            '  console.log(lives);',
            '}',
            'console.log(lives);',

            'let points = 10;',
            'for (let i = 0; i < 3; i = i + 1) {',
            '  points = points + 5;',
            '}',
            'console.log(points);',

            'let count = 0;',
            'for (let n = 0; n < 4; n = n + 1) {',
            '  count = count + 1;',
            '}',
            'console.log(count);',

            'let total = 0;',
            'for (let i = 0; i < 5; i = i + 1) {',
            '  total = total + 2;',
            '}',
            'console.log(total);',
            'console.log("done");',
          ],
        },
        tierRules: {
          minTier: 1,
          maxTier: 3,
          promoteIf: { wpm: 28, accuracy: 0.95, streak: 2 },
          demoteIf: { wpm: 14, accuracy: 0.85, streak: 2 },
        },
      },
    ],
    finalChallenge: {
      label: 'Final Challenge',
      language: 'javascript',
      prompt:
        'Declare a variable score starting at 0. Write a for loop that runs 5 times and adds 1 to score each iteration using score = score + 1. On each iteration log score with console.log.',
      starterCode: '// Write your code here\n',
      expectedOutput: '1\n2\n3\n4\n5\n',
    },
  },
]
