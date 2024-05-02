const { execute } = require("./execute");
const { Parser } = require("./parser");
const { SemanticAnalyzer } = require("./semanticAnalyzer");
const readline = require("readline");
const fs = require("fs");

// const sampleProgram = `
//   BEGIN CODE
//   INT x, y, z=5, a=z, b=10, c=20
//   SCAN: x,y
//   DISPLAY: z & ((x*y)-(x+y)-z)*2 >= 100
//   #a=z
//   DISPLAY: (a < b AND c < 200)
//   DISPLAY: a & z & $ & [&]
//   END CODE`;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Enter the filename: ", (filename) => {
  fs.readFile(`${filename}.CODE`, "utf8", (err, data) => {
    if (err) {
      console.error("No such file with .CODE extension found.");
      rl.close();
      return;
    }

    const parser = new Parser(data);
    const ast = parser.parse();

    const analyzer = new SemanticAnalyzer(ast);

    const result = analyzer.analyze();

    if (result.pass) {
      execute(result.ast);
    }
  });

  rl.close();
});
