const AI_MAPPINGS = {
  "modern": ["minimalist", "contemporary", "sleek", "clean lines", "new"],
  "traditional": ["classic", "heritage", "vintage", "old world", "historical"],
  "nature": ["greenery", "plants", "garden", "outdoor", "landscape", "forest"],
  "luxury": ["premium", "expensive", "elegant", "high-end", "mansion", "villa"],
  "cozy": ["warm", "small", "intimate", "comfy", "soft"],
  "tech": ["ai", "future", "smart", "robot", "digital"],
  "business": ["startup", "founder", "entrepreneur", "growth", "money"]
};

export function expandQuery(query) {
  if (!query) return "";
  const words = query.toLowerCase().trim().split(/\s+/);
  const expanded = new Set(words);
  
  words.forEach(word => {
    Object.entries(AI_MAPPINGS).forEach(([key, synonyms]) => {
      // Match key OR any synonym in the list
      const matchesKey = word.includes(key) || key.includes(word);
      const matchesSynonym = synonyms.some(syn => word.includes(syn) || syn.includes(word));
      if (matchesKey || matchesSynonym) {
        expanded.add(key);
        synonyms.forEach(syn => expanded.add(syn));
      }
    });
  });
  
  // Return space-separated for 'websearch' type which is most natural for users
  return Array.from(expanded).join(' OR ');
}
