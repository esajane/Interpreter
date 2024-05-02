/*
Increment 1
1. Basic Program Structure (BEGIN CODE END CODE block)
2. Comments
3. Variable Declaration and Initialization
4. Reserved words
5. DISPLAY function
*/

const increment1Tests = [
  {
    input: `BEGIN CODE
      INT x=5, y=10, z
      DISPLAY: x & y
      END CODE`,
    output: "510",
  },
  {
    input: `BEGIN CODE
      INT x=5, y=10, z
      # this is a comment
      DISPLAY: x & y
      END CODE`,
    output: "510",
  },
  {
    input: `BEGIN CODE
      INT x=5, INT=10, z
      BOOL t="TRUE"
      DISPLAY: x & y & t
      END CODE`,
    output: null,
  },
];

// Output: 4TRUE5
// n#last
const testCase1 = `BEGIN CODE
INT x, y, z=5
CHAR a_1=’n’
BOOL t=”TRUE”
x=y=4
a_1=’c’
# this is a comment
DISPLAY: x & t & z & $ & a_1 & [#] & “last”
END CODE`;

// Output: [-60]
const testCase2 = `BEGIN CODE
INT xyz, abc=100
xyz= ((abc *5)/10 + 10) * -1
DISPLAY: [[] & xyz & []]
END CODE`;

// Output: TRUE
const testCase3 = `BEGIN CODE
INT a=100, b=200, c=300
BOOL d=”FALSE”
d = (a < b AND c <>200)
DISPLAY: d
END CODE`;

export const testOne = (test) => {
  switch (test) {
    case 1:
      return testCase1;
    case 2:
      return testCase2;
    case 3:
      return testCase3;
    default:
      return testCase1;
  }
};

export const testAll = () => {
  return [testCase1, testCase2, testCase3];
};
