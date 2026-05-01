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
    Object.keys(AI_MAPPINGS).forEach(key => {
      // Direct match or partial match
      if (word.includes(key) || key.includes(word)) {
        AI_MAPPINGS[key].forEach(syn => expanded.add(syn));
      }
    });
  });
  
  // Return space-separated for 'websearch' type which is most natural for users
  return Array.from(expanded).join(' ');
}
