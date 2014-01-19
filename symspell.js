/**
 * An implementation of the Symmetric Delete spelling correction algorithm.
 *
 * This is very fast and language-independent.
 *
 * Based on C# code and algorithm version 1.6
 * Copyright (C) 2012 Wolf Garbe <wolf.garbe@faroo.com>, FAROO Limited
 * See: http://blog.faroo.com/2012/06/07/improved-edit-distance-based-spelling-correction/
 * and http://blog.faroo.com/2012/06/24/1000x-faster-spelling-correction-source-code-released/
 *
 * This version was written by Isaac Sukin (@IceCreamYou).
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License,
 * version 3.0 (LGPL-3.0) as published by the Free Software Foundation.
 * http://www.opensource.org/licenses/LGPL-3.0
 */

(function(window) {

/**
 * Initializes a dictionary to perform spellcheck lookups.
 *
 * Usage:
 *     var spellchecker = new SymSpell();
 *     spellchecker.addWords('all the words in your dictionary', 'en');
 *     var suggestions = spellchecker.lookup('nn'); // ['in']
 *
 * @param {Number} [maxEditDistance=2]
 *   The maximum Damerau-Levenshtein distance from the input word that a
 *   dictionary word could be to qualify for a suggested correction.
 * @param [mode=SymSpell.Modes.ALL]
 *   Determines the set of suggestions to return:
 *   - SymSpell.Modes.TOP causes only the top suggestion to return
 *   - SymSpell.Modes.SMALLEST means return all suggestions with the smallest
 *     edit distance
 *   - SymSpell.Modes.ALL means return all suggestions with an edit distance
 *     smaller than the maximum
 */
window.SymSpell = function(maxEditDistance, mode) {
  this.maxEditDistance = maxEditDistance || 2;
  this.mode = typeof mode === 'undefined' ? SymSpell.Modes.ALL : mode;
  this.dictionary = {};
};

SymSpell.Modes = {
  TOP: 0,
  SMALLEST: 1,
  ALL: 2
};

/**
 * Adds words to the dictionary from a corpus.
 *
 * @param {String} corpus
 *   A string containing all words that should be added to the dictionary for
 *   lookups.
 * @param {String} [language='und']
 *   A language identifier, such as "en". You can use whatever you want as an
 *   identifier as long as no identifier is a prefix of another identifier.
 * @param {Function} [tokenizer]
 *   A function that splits the corpus into individual words to add to the
 *   dictionary. The default implementation attempts to parse the corpus with
 *   no assumptions about its contents. If you already have a tokenized
 *   dictionary, for example a string with each word on a separate line, then
 *   you may want to use your own tokenizer instead.
 */
SymSpell.prototype.addWords = function(corpus, language, tokenizer) {
  language = language || 'und';
  tokenizer = tokenizer || tokenize;
  var words = tokenizer(corpus);
  for (var i = 0, l = words.length; i < l; i++) {
    this.addWord(words[i], language);
  }
};

/**
 * Adds a word to the dictionary.
 *
 * (Technically, adds all permutations of the word that can be created by
 * deleting between 1 and self.maxEditDistance characters.)
 *
 * @param {String} word
 *   The word to add to the dictionary.
 * @param {String} [language='und']
 *   A language identifier, such as "en". You can use whatever you want as an
 *   identifier as long as no identifier is a prefix of another identifier.
 */
SymSpell.prototype.addWord = function(word, language) {
  var item = new DictionaryItem();
  var key = language + word;
  if (this.dictionary[key]) {
    item = this.dictionary[key];
  }
  else {
    item.term = word;
    this.dictionary[key] = item;
    var possibleSuggestions = computePermutations(word, 0, this.maxEditDistance);
    for (var i = 0, l = possibleSuggestions.length; i < l; i++) {
      var ps = possibleSuggestions[i];
      var suggestion = new EditItem();
      suggestion.term = word;
      suggestion.distance = ps.distance;
      if (this.dictionary[language+ps.term]) {
        var entry = this.dictionary[language+ps.term];
        if (!wordListContains(entry.suggestions, suggestion)) {
          addOrTerminateEarly(entry.suggestions, suggestion, this.mode);
        }
      }
      else {
        var entry2 = new DictionaryItem();
        entry2.suggestions.push(suggestion);
        this.dictionary[language+ps.term] = entry2;
      }
    }
  }
  item.count++;
};

/**
 * Suggests corrections for a word.
 *
 * @param {String} word
 *   The input for which corrections should be suggested.
 * @param {String} [language='und']
 *   A language identifier, such as "en". You can use whatever you want as an
 *   identifier as long as no identifier is a prefix of another identifier.
 *
 * @return {SuggestItem[]}
 *   An array of objects representing words to suggest. Each object in the
 *   array has a `term` property which holds a correct word (as a string); a
 *   `distance` property which indicates the Damerau-Levenshtein distance
 *   between the input and the correction; and a `count` property indicating
 *   the number of times the word is in the dictionary. Results are sorted by
 *   distance ascending, then count descending.
 */
SymSpell.prototype.lookup = function(word, language) {
  language = language || 'und';
  var candidates = [];

  var item = new EditItem();
  item.term = word;
  item.distance = 0;
  candidates.push(item);

  var suggestions = [];

  function sort() {
    suggestions = suggestions.sort(function(a, b) {
      var d = a.distance - b.distance;
      return d ? d : b.count - a.count;
    }).filter(function(a) {
      return a.term;
    });
    return (this.mode === SymSpell.Modes.TOP && suggestions.length > 1) ? [suggestions[0]] : suggestions;
  }

  while (candidates.length > 0) {
    var candidate = candidates.shift();
    if ((this.mode !== SymSpell.Modes.ALL && suggestions.length && candidate.distance > suggestions[0].distance) ||
        candidate.distance > this.maxEditDistance) {
      return sort();
    }

    var key = language + candidate.term;
    if (this.dictionary[key]) {
      var si = new SuggestItem();
      si.term = this.dictionary[key].term;
      si.count = this.dictionary[key].count;
      si.distance = candidate.distance;
      if (!wordListContains(suggestions, si)) {
        suggestions.push(si);
        if (this.mode != SymSpell.Modes.ALL && !candidate.distance) {
          return sort();
        }
      }

      var s = this.dictionary[key].suggestions;
      for (var i = 0, l = s.length; i < l; i++) {
        var suggestion = s[i];
        if (!wordListContains(suggestions, suggestion)) {
          var distance = realEditDistance(suggestion, candidate, word);
          if (this.mode !== SymSpell.Modes.ALL && suggestions.length) {
            if (suggestions[0].distance > distance) {
              suggestions.length = 0;
            }
            else if (distance > suggestions[0].distance) {
              continue;
            }
          }
          if (distance < this.maxEditDistance && this.dictionary[language+suggestion.term]) {
            var di = this.dictionary[language+suggestion.term];
            var sim = new SuggestItem();
            sim.term = di.term;
            sim.count = di.count;
            sim.distance = distance;
            suggestions.push(sim);
          }
        }
      }
    }

    if (candidate.distance < this.maxEditDistance) {
      var perms = computePermutations(candidate.term, candidate.distance, 0);
      for (var j = 0, m = perms.length; j < m; j++) {
        if (!wordListContains(candidates, perms[j])) {
          candidates.push(perms[j]);
        }
      }
    }
  }

  return sort();
};

var Word = function() {
  this.term = '';
};
Word.prototype.equals = function(obj) {
  return obj && typeof obj.term !== 'undefined' && obj.term == this.term;
};

var DictionaryItem = function() {
  Word.call(this);
  this.suggestions = [];
  this.count = 0;
};
DictionaryItem.prototype = Object.create(Word.prototype);

var EditItem = function() {
  Word.call(this);
  this.distance = 0;
};
EditItem.prototype = Object.create(Word.prototype);

var SuggestItem = function() {
  Word.call(this);
  this.distance = 0;
  this.count = 0;
};
SuggestItem.prototype = Object.create(Word.prototype);

/**
 * Splits a string into words.
 *
 * This implementation attempts to parse a corpus with no assumptions about its
 * contents. If you already have a tokenized dictionary, for example a string
 * with each word on a separate line, then you may want to use your own
 * tokenizer instead.
 *
 * @return {String[]}
 */
function tokenize(corpus) {
  return corpus.toLowerCase().match(/([\w\d_](-[\w\d_])?('(t|d|s|m|ll|re|ve))?)+/g);
}

/**
 * Compute variations of a word by deleting characters.
 *
 * @param {String} word
 *   The word for which variations should be computed.
 * @param {Number} [editDistance=0]
 *   The number of characters that have already been deleted from the input
 *   word.
 * @param {Number} [maxEditDistance]
 *   The maximum number of characters to delete from the input word to create a
 *   variant.
 *
 * @return {EditItem[]}
 */
function computePermutations(word, editDistance, maxEditDistance) {
  editDistance = (editDistance || 0) + 1;
  var permutations = [], l = word.length, i, j, m;
  if (l > 1) {
    for (i = 0; i < l; i++) {
      var p = new EditItem();
      p.term = word.slice(0, i) + word.slice(i+1);
      p.distance = editDistance;
      if (permutations.indexOf(p) === -1) {
        permutations.push(p);
        if (typeof maxEditDistance !== 'undefined' && editDistance < maxEditDistance) {
          var nextPermutations = computePermutations(p.term, editDistance, maxEditDistance);
          for (j = 0, m = nextPermutations.length; j < m; j++) {
            if (permutations.indexOf(nextPermutations[j]) === -1) {
              permutations.push(nextPermutations[j]);
            }
          }
        }
      }
    }
  }
  return permutations;
}

/**
 * Checks if a list of Items contains a given Item value.
 */
function wordListContains(list, value) {
  for (var i = 0, l = list.length; i < l; i++) {
    if (list[i].equals(value)) return true;
  }
  return false;
}

function addOrTerminateEarly(suggestions, suggestion, mode) {
  if (mode !== SymSpell.Modes.ALL && suggestions.length && suggestions[0].distance > suggestion.distance) {
    suggestions.length = 0;
  }
  if (mode === SymSpell.Modes.ALL || !suggestions.length || suggestions[0].distance >= suggestion.distance) {
    suggestions.push(suggestion);
  }
}

/**
 * Calculates the Damerau-Levenshtein distance between two strings.
 */
function distance(source, target) {
  if (!source) return target ? target.length : 0;
  else if (!target) return source.length;

  var m = source.length, n = target.length, INF = m+n, score = new Array(m+2), sd = {}, i, j;
  for (i = 0; i < m+2; i++) { score[i] = new Array(n+2); }
  score[0][0] = INF;
  for (i = 0; i <= m; i++) {
    score[i+1][1] = i;
    score[i+1][0] = INF;
    sd[source[i]] = 0;
  }
  for (j = 0; j <= n; j++) {
    score[1][j+1] = j;
    score[0][j+1] = INF;
    sd[target[j]] = 0;
  }

  for (i = 1; i <= m; i++) {
    var DB = 0;
    for (j = 1; j <= n; j++) {
      var i1 = sd[target[j-1]],
          j1 = DB;
      if (source[i-1] === target[j-1]) {
        score[i+1][j+1] = score[i][j];
        DB = j;
      }
      else {
        score[i+1][j+1] = Math.min(score[i][j], Math.min(score[i+1][j], score[i][j+1])) + 1;
      }
      score[i+1][j+1] = Math.min(score[i+1][j+1], score[i1] ? score[i1][j1] + (i-i1-1) + 1 + (j-j1-1) : Infinity);
    }
    sd[source[i-1]] = i;
  }
  return score[m+1][n+1];
}

function realEditDistance(dictItem, inputPermutation, input) {
  if (dictItem.term === input) return 0;
  else if (!dictItem.distance) return inputPermutation.distance;
  else if (!inputPermutation.distance) return dictItem.distance;
  else return distance(dictItem.term, input);
}

})(window);
