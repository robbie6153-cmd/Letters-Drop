// dictionary.js - loads a full English word list

let dictionary = [];
let dictionaryLoaded = false;

fetch("https://cdn.jsdelivr.net/npm/an-array-of-english-words/index.json")
  .then(response => response.json())
  .then(words => {
    dictionary = words
      .map(word => String(word).trim().toUpperCase())
      .filter(word => /^[A-Z]{3,9}$/.test(word));

    dictionaryLoaded = true;

    console.log("Dictionary loaded:", dictionary.length, "words");
    console.log("TEN?", dictionary.includes("TEN"));
    console.log("OWED?", dictionary.includes("OWED"));
    console.log("KILL?", dictionary.includes("KILL"));
    console.log("HOOD?", dictionary.includes("HOOD"));

    if (typeof onDictionaryReady === "function") {
      onDictionaryReady();
    }
  })
  .catch(error => {
    console.error("Error loading dictionary:", error);
  });

function getDictionaryArray() {
  return dictionary;
}

function isDictionaryLoaded() {
  return dictionaryLoaded;
}