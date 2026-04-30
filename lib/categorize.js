// Subcategory mapping
export const SUBCATEGORIES = {
  "tech-ai": [
    { id: "ai-tools", label: "AI Tools", keywords: /ai|gpt|claude|midjourney|llm|agent|stable diffusion/ },
    { id: "coding", label: "Coding", keywords: /code|python|github|programming|software|dev|repo/ },
    { id: "productivity", label: "Productivity", keywords: /efficient|logic|workflow|automation|organize/ },
    { id: "future", label: "Future Tech", keywords: /future|hardware|gadget|space|robot/ }
  ],
  "business": [
    { id: "founders", label: "Founders", keywords: /startup|founder|founder|entrepreneur|stories/ },
    { id: "marketing", label: "Marketing", keywords: /brand|marketing|budget|sales|customer|ad/ },
    { id: "finance", label: "Finance & VC", keywords: /venture|funding|invest|money|finance|capital/ },
    { id: "strategy", label: "Strategy", keywords: /strategy|operations|business model|plan/ }
  ],
  "lifestyle": [
    { id: "mindset", label: "Mindset", keywords: /mindset|philosophy|growth|perspective|wisdom/ },
    { id: "family", label: "Family", keywords: /family|child|relationship|maa|love/ },
    { id: "wellness", label: "Wellness", keywords: /health|wellness|happy|sad|emotion|mental/ },
    { id: "personal-finance", label: "Personal Finance", keywords: /saving|budgeting|investing|finance|wealth/ }
  ],
  "travel": [
    { id: "destinations", label: "Destinations", keywords: /eiffel|visit|tour|explore|visit|mountain|beach/ },
    { id: "stays", label: "Stays", keywords: /hotel|airbnb|stay|villa|cabin|resort/ },
    { id: "tips", label: "Travel Tips", keywords: /tips|hacks|pack|itinerary/ },
    { id: "nature", label: "Nature", keywords: /outdoors|nature|hiking|wildlife/ }
  ],
  "home-design": [
    { id: "architecture", label: "Architecture", keywords: /architect|facade|villa|building|structure/ },
    { id: "interiors", label: "Interiors", keywords: /interior|living|bedroom|kitchen|sofa|furniture/ },
    { id: "decor", label: "Decor", keywords: /decor|aesthetic|art|minimal/ },
    { id: "lighting", label: "Lighting", keywords: /lighting|lamp|glow|light/ }
  ]
};

export function inferFullTaxonomy(caption, hashtags) {
  const text = ((caption || '') + ' ' + (hashtags || []).join(' ')).toLowerCase();
  
  let category = 'other';
  let subCategory = 'other';

  // 1. Infer Category
  if (text.match(/ai|claude|gpt|code|python|repo|efficient|logic|tech|dev|software|agent|prompt/)) category = 'tech-ai';
  else if (text.match(/startup|yc|founder|marketing|brand|budget|paul graham|business|customer|sales|pitch|venture/)) category = 'business';
  else if (text.match(/love|relationship|maa|life|secrets|perspective|child|family|mindset|growth|happiness|sad|emotion/)) category = 'lifestyle';
  else if (text.match(/travel|trip|road trip|vacation|staycation|stay|eiffel|visit|tour|explore|mountain|beach/)) category = 'travel';
  else if (text.match(/home|interior|living|bedroom|kitchen|sofa|furniture|decor|room|villa|facade|architect|design|aesthetic|house|cabin|studio/)) category = 'home-design';

  // 2. Infer Subcategory
  if (category !== 'other' && SUBCATEGORIES[category]) {
    for (const sub of SUBCATEGORIES[category]) {
      if (text.match(sub.keywords)) {
        subCategory = sub.id;
        break;
      }
    }
  }

  return { category, subCategory };
}
