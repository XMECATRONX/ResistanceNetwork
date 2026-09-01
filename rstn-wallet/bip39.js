/**
 * RSTN Wallet — Lightweight mnemonic generator.
 *
 * Generates a 24-word backup phrase from 24 random bytes using a curated
 * 256-word list (8 bits per word → 192 bits of entropy). The phrase is
 * deterministic input to PBKDF2-SHA256 (see generateKeypairFromSeed in
 * background.js), so import regenerates the exact same post-quantum keypair.
 *
 * NOTE: This is a custom wordlist (not BIP39) — RSTN keys are post-quantum
 * (Dilithium3) and not BIP32/44 compatible. The phrase is a RSTN backup only.
 */
(function (self) {
  const WORDLIST = [
    "abandon","ability","able","about","above","absent","absorb","abstract","absurd","abuse","access","accident",
    "account","accuse","achieve","acid","acoustic","acquire","across","action","actor","actual","adapt","add",
    "addict","address","adjust","admit","adult","advance","advice","aerobic","affair","afford","afraid","again",
    "age","agent","agree","ahead","aim","air","airport","aisle","alarm","album","alcohol","alert",
    "alien","all","alley","allow","almost","alone","alpha","already","also","alter","always","amateur",
    "amazing","among","amount","amused","analyst","anchor","ancient","anger","angle","angry","animal","ankle",
    "announce","annual","another","answer","antenna","antique","anxiety","any","apart","apology","appear","apple",
    "approve","april","arch","arctic","area","arena","argue","arm","armed","armor","army","around",
    "arrange","arrest","arrive","arrow","art","artefact","artist","artwork","ask","aspect","assault","asset",
    "assist","assume","asthma","athlete","atom","attack","attend","attitude","attract","auction","audit","august",
    "aunt","author","auto","autumn","average","avocado","avoid","awake","aware","away","awesome","awful",
    "awkward","axis","baby","bachelor","bacon","badge","bag","balance","balcony","ball","bamboo","banana",
    "banner","bar","barely","bargain","barrel","base","basic","basket","battle","beach","bean","beauty",
    "because","become","beef","before","begin","behave","behind","believe","below","belt","bench","benefit",
    "best","betray","better","between","beyond","bicycle","bid","bike","bind","biology","bird","birth",
    "bitter","black","blade","blame","blanket","blast","bleak","bless","blind","blood","blossom","blouse",
    "blue","blur","blush","board","boat","body","boil","bomb","bone","bonus","book","boost",
    "border","boring","borrow","boss","bottom","bounce","box","boy","bracket","brain","brand","brass",
    "brave","bread","breeze","brick","bridge","brief","bright","bring","brisk","broccoli","broken","bronze",
    "broom","brother","brown","brush","bubble","buddy","budget","buffalo","build","bulb","bulk","bullet",
    "bundle","bunker","burden","burger","burst","bus","business","busy","butter","buyer","buzz","cabbage",
    "cabin","cable","cactus","cage","cake","call","calm","camera","camp","can","canal","cancel",
    "candy","cannon","canoe","canvas","canyon","capable","capital","captain","car","carbon","card","cargo"
  ];

  function randomBytes(n) {
    return crypto.getRandomValues(new Uint8Array(n));
  }

  /**
   * Generate a mnemonic phrase of `wordCount` words (default 24).
   * Each word encodes 8 bits of entropy (256-word list).
   */
  function generateMnemonic(wordCount) {
    const n = wordCount === 12 ? 12 : 24;
    const bytes = randomBytes(n);
    const words = [];
    for (let i = 0; i < n; i++) {
      words.push(WORDLIST[bytes[i] % WORDLIST.length]);
    }
    return words.join(" ");
  }

  /**
   * Validate that a phrase consists of 12 or 24 words from the wordlist.
   * Returns true if every word is a known wordlist entry.
   */
  function isValidMnemonic(phrase) {
    const words = phrase.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (words.length !== 12 && words.length !== 24) return false;
    const set = new Set(WORDLIST);
    return words.every((w) => set.has(w));
  }

  self.rstnBip39 = { generateMnemonic, isValidMnemonic, WORDLIST };
})(self);
