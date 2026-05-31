// Single source of truth for category/subcategory taxonomy.
// Used by: import route, sync route, organize route, dashboard client.

export const CATEGORIES = [
  { id: "tech-ai",     label: "Tech & AI",            keywords: /\bai\b|claude|gpt|llm|openai|neural|model|agent|mcp|code|python|javascript|typescript|programming|software|dev\b|repo|github|startup\s*tech|saas|api|backend|frontend|server|database|ml\b|machine.learn|deep.learn|data.science|prompt|cursor|copilot|midjourney|stable.diff|diffusion|gadget|robot|drone|hardware|chip|semiconductor|quantum|cyber|hack|security|algorithm/ },
  { id: "business",    label: "Business & Startups",   keywords: /startup|yc|y.combinator|founder|entrepreneur|vc\b|venture|funding|angel|seed.round|series.a|business|brand|marketing|sales|customer|conversion|revenue|mrr|arr|pitch|deck|product.market|growth.hack|seo|copywrite|copywriting|ad\b|ads\b|paid.social|go.to.market|strategy|operations|b2b|b2c|saas/ },
  { id: "lifestyle",   label: "Lifestyle & Growth",    keywords: /love|relationship|dating|maa|family|child|parent|mother|father|friendship|mindset|philosophy|stoic|growth|perspective|wisdom|habit|routine|discipline|book|read|learn|mental.health|wellness|emotion|happy|sad|anxiety|meditat|journal|gratitude|self.improv|productivity|morning.routine|life.hack|minimalis/ },
  { id: "food",        label: "Food & Cooking",         keywords: /recipe|food|cook|bake|chef|restaurant|eat|meal|breakfast|lunch|dinner|snack|dessert|cake|coffee|tea|cocktail|wine|beer|pizza|pasta|sushi|vegan|vegetarian|keto|diet|nutrition|cuisine|kitchen|flavor|ingredient|spice/ },
  { id: "fitness",     label: "Fitness & Sports",       keywords: /workout|gym|fitness|exercise|training|yoga|pilates|running|marathon|cycling|swim|sport|athlete|muscle|weight.loss|protein|supplement|crossfit|hiit|strength|cardio|stretch|mobility|recovery|coach/ },
  { id: "travel",      label: "Travel & Stays",         keywords: /travel|trip|road.trip|vacation|holiday|staycation|eiffel|visit|tour|explore|mountain|beach|island|hotel|airbnb|hostel|resort|stay\b|cabin|villa\b|booking|flight|passport|backpack|itinerary|destination|wanderlust|bucket.list|city.guide/ },
  { id: "home-design", label: "Home & Design",          keywords: /home|interior|living.room|bedroom|kitchen|bathroom|sofa|furniture|decor|room|villa|facade|architect|design|aesthetic|house|cabin.design|studio|apartment|renovation|remodel|floor.plan|layout|space|minimal|scandinavian|japandi|boho|wabi.sabi|mid.century|modern.home|cozy|ambiance|lighting|curtain|rug/ },
  { id: "fashion",     label: "Fashion & Style",        keywords: /fashion|outfit|ootd|style|wear|dress|shirt|jeans|sneaker|shoe|bag|accessory|jewel|watch|luxury|brand|gucci|louis|prada|streetwear|aesthetic.fit|capsule.wardrobe|thrift|vintage.fashion/ },
  { id: "art-culture", label: "Art & Culture",          keywords: /art|paint|illustration|draw|sketch|museum|gallery|exhibit|culture|history|heritage|tradition|ritual|festival|music|concert|album|film|movie|cinema|photography|photo|portrait|landscape.photo|creative|design.art|typography|graphic.design/ },
  { id: "other",       label: "Everything Else",        keywords: null },
];

export const SUBCATEGORIES = {
  "tech-ai": [
    { id: "ai-tools",    label: "AI Tools",      keywords: /\bai\b|gpt|claude|llm|agent|midjourney|stable.diff|diffusion|openai|anthropic|model|neural|ml\b|deep.learn/ },
    { id: "coding",      label: "Coding",         keywords: /code|python|javascript|typescript|github|programming|software|dev\b|repo|frontend|backend|api|database|algorithm|cursor|copilot/ },
    { id: "productivity",label: "Productivity",   keywords: /productive|workflow|automation|organize|system|notion|obsidian|tools|dashboard|efficiency|focus|deep.work/ },
    { id: "future",      label: "Future Tech",    keywords: /future|hardware|gadget|space|robot|drone|quantum|semiconductor|chip|biotech|augment|vr\b|ar\b|xr\b/ },
    { id: "cybersecurity",label: "Security",      keywords: /security|hack|cyber|privacy|encrypt|vulnerability|pentest/ },
  ],
  "business": [
    { id: "founders",   label: "Founders",        keywords: /startup|yc|founder|entrepreneur|ceo|cto|builder|indie.hacker|bootstrapped|stories/ },
    { id: "marketing",  label: "Marketing",       keywords: /marketing|brand|seo|copywrite|content.market|social.media|email.market|paid.social|ads\b|conversion/ },
    { id: "finance",    label: "Finance & VC",    keywords: /vc\b|venture|funding|invest|money|finance|capital|angel|seed|series/ },
    { id: "strategy",   label: "Strategy",        keywords: /strategy|operations|go.to.market|product.market|growth|b2b|b2c|mrr|arr|revenue/ },
  ],
  "lifestyle": [
    { id: "mindset",         label: "Mindset",         keywords: /mindset|philosophy|stoic|perspective|wisdom|growth|discipline|habit|routine|journaling|gratitude|self.improv/ },
    { id: "family",          label: "Family",           keywords: /family|child|parent|mother|father|maa|friendship|relationship|love|dating/ },
    { id: "wellness",        label: "Wellness",         keywords: /wellness|health|mental|emotion|meditat|anxiety|therapy|happiness|sleep|rest/ },
    { id: "personal-finance",label: "Money",            keywords: /saving|budgeting|investing|wealth|financial.free|passive.income|money/ },
    { id: "reading",         label: "Books & Learning", keywords: /book|read|learn|course|podcast|newsletter|knowledge/ },
  ],
  "food": [
    { id: "recipes",    label: "Recipes",         keywords: /recipe|how.to.cook|ingredient|step.by.step/ },
    { id: "restaurants",label: "Restaurants",     keywords: /restaurant|cafe|bar|bistro|dine|eat.at|visit.this/ },
    { id: "baking",     label: "Baking & Desserts",keywords: /bake|cake|cookie|bread|pastry|dessert|sweet/ },
    { id: "drinks",     label: "Coffee & Drinks", keywords: /coffee|tea|cocktail|wine|beer|latte|cappuccino|espresso/ },
  ],
  "fitness": [
    { id: "workouts",   label: "Workouts",        keywords: /workout|gym|exercise|training|hiit|crossfit|strength|cardio/ },
    { id: "yoga",       label: "Yoga & Pilates",  keywords: /yoga|pilates|stretch|mobility|breath/ },
    { id: "running",    label: "Running & Cardio",keywords: /running|marathon|cycling|swim|cardio/ },
    { id: "nutrition",  label: "Nutrition",       keywords: /nutrition|protein|supplement|diet|keto|vegan|meal.prep/ },
  ],
  "travel": [
    { id: "destinations",label: "Places",         keywords: /visit|explore|tour|destination|city.guide|guide|must.see|bucket.list|mountain|beach|island/ },
    { id: "stays",      label: "Stays",            keywords: /hotel|airbnb|stay\b|villa|cabin|resort|hostel|booking/ },
    { id: "tips",       label: "Travel Tips",      keywords: /tips|hacks|pack|itinerary|budget.travel|solo.travel|travel.with/ },
    { id: "nature",     label: "Nature",           keywords: /outdoors|nature|hiking|wildlife|forest|camping|trek/ },
  ],
  "home-design": [
    { id: "architecture",label: "Architecture",   keywords: /architect|facade|building|structure|floor.plan|layout/ },
    { id: "interiors",  label: "Interiors",        keywords: /interior|living|bedroom|kitchen|bathroom|sofa|furniture|room/ },
    { id: "decor",      label: "Decor",            keywords: /decor|aesthetic|art|minimal|japandi|scandinavian|boho|wabi|cozy/ },
    { id: "lighting",   label: "Lighting",         keywords: /lighting|lamp|glow|light|ambiance/ },
  ],
  "fashion": [
    { id: "outfits",    label: "Outfits",          keywords: /ootd|outfit|wear|style|look/ },
    { id: "luxury",     label: "Luxury",           keywords: /luxury|gucci|prada|louis|designer/ },
    { id: "streetwear", label: "Streetwear",       keywords: /streetwear|sneaker|hypebeast|drop/ },
    { id: "minimalist-fashion",label: "Minimalist",keywords: /capsule|minimal|essential|wardrobe/ },
  ],
  "art-culture": [
    { id: "visual-art", label: "Art & Illustration",keywords: /paint|illustration|draw|sketch|art\b|gallery|exhibit/ },
    { id: "photography",label: "Photography",      keywords: /photo|photograph|portrait|landscape.photo|shoot|camera/ },
    { id: "music-film", label: "Music & Film",     keywords: /music|concert|album|film|movie|cinema|director/ },
    { id: "culture",    label: "Culture",           keywords: /culture|history|heritage|tradition|festival|ritual/ },
  ],
};

// Extract top hashtags from a text as sorted frequency map
export function extractTopHashtags(texts, limit = 20) {
  const freq = {};
  for (const text of texts) {
    if (!text) continue;
    const tags = (text.match(/#[\w\u00C0-\u024F]+/g) || []).map((h) => h.toLowerCase());
    for (const tag of tags) freq[tag] = (freq[tag] || 0) + 1;
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));
}

export function inferFullTaxonomy(caption, hashtags) {
  const raw = ((caption || '') + ' ' + (hashtags || []).join(' ')).toLowerCase();

  let category = 'other';
  let subCategory = 'other';

  for (const cat of CATEGORIES) {
    if (!cat.keywords) continue; // skip "other"
    if (raw.match(cat.keywords)) {
      category = cat.id;
      break;
    }
  }

  if (category !== 'other' && SUBCATEGORIES[category]) {
    for (const sub of SUBCATEGORIES[category]) {
      if (raw.match(sub.keywords)) {
        subCategory = sub.id;
        break;
      }
    }
  }

  return { category, subCategory };
}
