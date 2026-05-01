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
  const words = query.toLowerCase().split(/\s+/);
  const expanded = new Set(words);
  
  words.forEach(word => {
    Object.keys(AI_MAPPINGS).forEach(key => {
      if (word.includes(key) || key.includes(word)) {
        AI_MAPPINGS[key].forEach(syn => expanded.add(syn));
      }
    });
  });
  
  return Array.from(expanded).join(' | '); // Postgres TSQUERY format
}
