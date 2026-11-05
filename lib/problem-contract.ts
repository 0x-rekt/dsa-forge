type ContractContext = {
  tags: string[];
  sampleInput?: string;
};

export type PythonProblemContract = {
  methodName: string;
  starterCode: string;
  invocation: string;
  structure: string;
};

function inputShape(sampleInput: string | undefined) {
  if (!sampleInput) return "The test input is passed as a dictionary.";
  try {
    const parsed: unknown = JSON.parse(sampleInput);
    if (Array.isArray(parsed)) return "The test input is passed as a list.";
    if (parsed && typeof parsed === "object") {
      return `The test input is passed as a dictionary with keys: ${Object.keys(parsed).join(", ")}.`;
    }
  } catch {
    // Keep the generic description when a dataset input is not JSON.
  }
  return "The test input is passed as a dictionary.";
}

function structureFor(tags: string[]) {
  const normalized = tags.map((tag) => tag.toLowerCase());
  if (normalized.some((tag) => tag.includes("graph"))) {
    return `Graph inputs use ordinary Python containers. Use data["edges"] for edge
lists or data["graph"] for adjacency data, depending on the test input.`;
  }
  if (normalized.some((tag) => tag.includes("tree"))) {
    return `Tree inputs are kept as lists in the JSON test data. Convert data["root"]
to TreeNode objects if the problem requires pointer traversal.`;
  }
  if (normalized.some((tag) => tag.includes("linked") || tag.includes("list"))) {
    return `Linked-list inputs are kept as lists in the JSON test data. Convert the
relevant field to ListNode objects if pointer traversal is required.`;
  }
  if (normalized.some((tag) => tag.includes("matrix") || tag.includes("grid"))) {
    return "Matrix or grid inputs are nested Python lists, for example data[\"grid\"].";
  }
  return "Use the named fields in data and the Python lists, dictionaries, and values supplied by the test input.";
}

export function getPythonProblemContract({ tags, sampleInput }: ContractContext): PythonProblemContract {
  const structure = structureFor(tags);
  const shape = inputShape(sampleInput);
  return {
    methodName: "solve",
    structure,
    starterCode: `class Solution:
    def solve(self, data):
        # ${shape}
        # ${structure.replace(/\n/g, "\n        # ")}
        pass
`,
    invocation: "solver = solution.Solution()\nresult = solver.solve(data)",
  };
}
