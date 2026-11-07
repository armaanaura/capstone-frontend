import type { CapstoneData, Difficulty, Question } from "./types";

const deliveryQuestions: Question[] = [
  { id: "delivery-zones", capstoneId: "delivery-network", number: 1, title: "Map the delivery zones", difficulty: "Easy", concept: "Graph representation", story: "Every great delivery starts with a map. Model the city's delivery zones as vertices and its roads as edges, creating the foundation the rest of your delivery system will use." },
  { id: "delivery-neighborhoods", capstoneId: "delivery-network", number: 2, title: "Connect the neighborhoods", difficulty: "Medium", concept: "Connected components", story: "Your map is taking shape. Explore its connected components to discover which neighborhoods a driver can reach and identify the isolated zones that still need a connection." },
  { id: "delivery-driver", capstoneId: "delivery-network", number: 3, title: "Find the nearest driver", difficulty: "Medium", concept: "Multi-source BFS", story: "An order just came in. Search outward from all available drivers at once to find the closest match for each delivery zone. Your dispatch system is ready to make its first assignment." },
  { id: "delivery-priority", capstoneId: "delivery-network", number: 4, title: "Prioritize urgent orders", difficulty: "Medium", concept: "Priority queue", story: "Lunch-hour orders are piling up. Build a priority queue that brings time-sensitive deliveries to the front, so your dispatcher can pair the right driver with the most urgent order." },
  { id: "delivery-route", capstoneId: "delivery-network", number: 5, title: "Find the fastest route", difficulty: "Hard", concept: "Dijkstra’s algorithm", story: "Bring dispatch and order prioritization together. Use weighted roads and Dijkstra's algorithm to find the fastest route for each assigned driver, completing your end-to-end delivery network." },
];

type MiniQuestion = [title: string, concept: string, story: string, difficulty?: Difficulty];
function miniCapstone(topicId: string, title: string, description: string, entries: MiniQuestion[]) {
  const capstoneId = `${topicId}-capstone`;
  const questions: Question[] = entries.map(([questionTitle, concept, story, difficulty], index) => ({
    id: `${topicId}-${index + 1}`, capstoneId, number: index + 1, title: questionTitle,
    concept, story, difficulty: difficulty ?? (index === 0 ? "Easy" : "Medium"),
  }));
  return {
    capstone: { id: capstoneId, topicId, title, description, questionIds: questions.map((question) => question.id) },
    questions,
    prerequisites: questions.map((question, index) => ({ questionId: question.id, requires: index ? [questions[index - 1].id] : [] })),
    progress: { capstoneId, completedIds: [questions[0].id], currentQuestionId: questions[1].id },
  };
}

const minis = [
  miniCapstone("arrays", "The Inventory Room", "Turn a shelf full of data into a smarter inventory system.", [
    ["Stock the shelves", "Array traversal", "Catalog every item in the warehouse. Walk through your inventory array to calculate stock levels and establish your first reliable snapshot."],
    ["Find the missing shipment", "Hash map", "One shipment never arrived. Compare received items with your inventory using a hash map to find the missing delivery."],
    ["Balance the warehouse", "Prefix sums", "Use prefix sums to answer stock queries quickly, helping your inventory system balance supplies across warehouse sections."],
    ["Forecast the busy window", "Sliding window", "Find the busiest stretch of orders using a sliding window so the warehouse can prepare before demand peaks."],
  ]),
  miniCapstone("strings", "Search, Made Simple", "Build a search assistant, one useful feature at a time.", [
    ["Clean the search query", "String normalization", "Your search assistant starts with messy input. Normalize casing and whitespace so equivalent queries produce consistent results."],
    ["Spot matching phrases", "Pattern matching", "Add phrase matching to locate the user's words inside document titles and make your search assistant useful."],
    ["Suggest a better search", "Edit distance", "Catch near misses with edit distance, giving your search assistant helpful suggestions when users make a typo.", "Hard"],
  ]),
  miniCapstone("linked-lists", "On Repeat", "Build a playlist that moves with the listener.", [
    ["Queue the first tracks", "Singly linked list", "Represent each track as a node and connect them into a playlist that can grow as new songs arrive."],
    ["Remix the queue", "Pointer manipulation", "Let listeners rearrange the next tracks without rebuilding the playlist by updating the links between songs."],
    ["Keep the music playing", "Cycle detection", "Detect accidental loops in the queue so your music player never gets stuck on the same section of a playlist."],
  ]),
  miniCapstone("trees", "The Folder Explorer", "Give a growing collection of files a place to call home.", [
    ["Create the folder tree", "Tree representation", "Build a hierarchy of folders and files, giving your explorer a structured view of the workspace."],
    ["Explore every folder", "Depth-first search", "Traverse the hierarchy to list every file and make even deeply nested documents discoverable."],
    ["Measure folder sizes", "Postorder traversal", "Roll file sizes up from children to parents, adding accurate storage totals to your folder explorer."],
    ["Find a shared home", "Lowest common ancestor", "Find the closest shared folder for two files so your explorer can show the best place to organize them together."],
  ]),
  miniCapstone("dynamic-programming", "The Budget Planner", "Make a little planning go a long way.", [
    ["Count the saving paths", "Memoization", "Your budget planner begins with a savings target. Count ways to reach it while caching repeated calculations."],
    ["Make change work", "Coin change", "Find the fewest contributions needed to hit a target, making your planner's saving suggestions more practical."],
    ["Choose what matters", "0/1 knapsack", "Balance competing goals within a fixed budget using knapsack dynamic programming, completing your personal planning assistant.", "Hard"],
  ]),
];

export const sampleData: CapstoneData = {
  topics: [
    { id: "arrays", title: "Arrays", abbreviation: "[ ]", capstoneId: "arrays-capstone" },
    { id: "strings", title: "Strings", abbreviation: "Aa", capstoneId: "strings-capstone" },
    { id: "linked-lists", title: "Linked Lists", abbreviation: "↔", capstoneId: "linked-lists-capstone" },
    { id: "trees", title: "Trees", abbreviation: "Y", capstoneId: "trees-capstone" },
    { id: "graphs", title: "Graphs", abbreviation: "◇", capstoneId: "delivery-network" },
    { id: "dynamic-programming", title: "Dynamic Programming", abbreviation: "ƒ", capstoneId: "dynamic-programming-capstone" },
  ],
  capstones: [
    ...minis.map((mini) => mini.capstone),
    { id: "delivery-network", topicId: "graphs", title: "Delivery Network", description: "Build a city-wide delivery system, one connection at a time.", questionIds: deliveryQuestions.map((question) => question.id) },
  ],
  questions: [...minis.flatMap((mini) => mini.questions), ...deliveryQuestions],
  prerequisites: [
    ...minis.flatMap((mini) => mini.prerequisites),
    { questionId: "delivery-zones", requires: [] },
    { questionId: "delivery-neighborhoods", requires: ["delivery-zones"] },
    { questionId: "delivery-driver", requires: ["delivery-neighborhoods"] },
    { questionId: "delivery-priority", requires: ["delivery-neighborhoods"] },
    { questionId: "delivery-route", requires: ["delivery-driver", "delivery-priority"] },
  ],
  progress: [
    ...minis.map((mini) => mini.progress),
    { capstoneId: "delivery-network", completedIds: ["delivery-zones", "delivery-neighborhoods"], currentQuestionId: "delivery-driver" },
  ],
};
