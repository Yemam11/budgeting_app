export interface SeedRule {
  patterns: string[];
  categoryId: string;
}

export const SEED_RULES: SeedRule[] = [
  { categoryId: 'gas', patterns: ['esso', 'petro-canada', 'petro canada', 'shell', 'pioneer', 'husky', 'ultramar', 'circle k', 'canadian tire gas', 'mobil', 'chevron'] },
  { categoryId: 'groceries', patterns: ['metro', 'loblaw', 'sobeys', 'no frills', 'food basics', 'fortinos', 'longo', 'freshco', 'farm boy', 'costco wholesale', 'walmart supercentre', 'nofrills', 'zehrs', 'iga', 'bulk barn'] },
  { categoryId: 'cafe', patterns: ['starbucks', 'tim hortons', 'tim horton', 'second cup', 'mccafe', 'dark horse', 'balzac', 'aroma espresso', 'jimmy the greek'] },
  { categoryId: 'subscription', patterns: ['netflix', 'spotify', 'apple.com/bill', 'google *', 'googlestorage', 'disney plus', 'disney+', 'amazon prime memb', 'prime memb', 'youtube premium', 'crave', 'dropbox', 'icloud', 'chatgpt', 'openai', 'anthropic', 'claude.ai', 'github', 'notion', 'linkedin'] },
  { categoryId: 'entertainment', patterns: ['cineplex', 'landmark cinema', 'imax', 'steamgames', 'steampowered', 'playstation', 'nintendo', 'xbox', 'eventbrite', 'ticketmaster', 'stubhub'] },
  { categoryId: 'online-purchase', patterns: ['amazon.ca', 'amazon.com', 'amzn', 'ebay', 'aliexpress', 'shein', 'temu', 'etsy', 'best buy', 'bestbuy'] },
  { categoryId: 'clothing', patterns: ['uniqlo', 'h&m', 'zara', 'old navy', 'gap', 'lululemon', 'nike', 'adidas', 'aritzia', 'hudson', 'winners', 'sportchek', 'sport chek', 'roots', 'levi', 'nordstrom'] },
  { categoryId: 'transportation', patterns: ['uber', 'lyft', 'presto', 'go transit', 'ttc', 'via rail', 'parking', 'impark', 'precise park', 'green p', 'gta tolls', '407etr', '407 etr'] },
  { categoryId: 'bills-utilities', patterns: ['bell canada', 'bell mobility', 'rogers', 'telus', 'fido', 'freedom mobile', 'koodo', 'virgin mobile', 'chatr', 'enbridge', 'hydro', 'toronto hydro', 'alectra', 'oakville hydro', 'milton hydro', 'insurance', 'tenant insurance', 'home insurance', 'condo fee', 'property tax', 'rent payment'] },
  { categoryId: 'health-medical', patterns: ['dental', 'dentist', 'medical', 'physio', 'physiotherapy', 'chiropractic', 'pharmacy', 'rexall', 'shoppers drug', 'health center', 'health centre', 'clinic', 'optometr', 'massage therapy'] },
  { categoryId: 'food', patterns: ['restaurant', 'pizza', 'burger', 'sushi', 'mcdonald', 'wendy', 'subway sandwich', 'chipotle', 'kfc', 'a&w', 'popeye', 'five guys', 'swiss chalet', 'boston pizza', 'the keg', 'earls', 'milestones', 'doordash', 'ubereats', 'uber eats', 'skip the dishes', 'skipthedish', 'dicey business'] },
  { categoryId: 'investment', patterns: ['wealthsimple', 'questrade', 'td waterhouse', 'td direct', 'investment purchase', 'interactive brokers', 'ibkr'] },
  { categoryId: 'charity', patterns: ['unicef', 'red cross', 'doctors without borders', 'msf', 'united way', 'salvation army', 'food bank', 'donation'] },
  { categoryId: 'income', patterns: ['payroll deposit', 'payroll', 'gst', 'provincial payment', 'canada deposit', 'cra deposit'] },
];
