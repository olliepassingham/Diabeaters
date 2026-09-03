export const CARB_CATALOGUE_VERSION = "2026-09-02";

export type CarbFoodCategory =
  | "breakfast"
  | "bread"
  | "staples"
  | "fruit"
  | "dairy"
  | "snacks"
  | "drinks"
  | "meals";

export type CarbPortion = {
  id: string;
  label: string;
  carbsGrams: number;
  /** Expected variation from brands, recipes and serving size. */
  uncertaintyPercent: number;
};

export type CarbFood = {
  id: string;
  name: string;
  aliases: string[];
  category: CarbFoodCategory;
  portions: CarbPortion[];
};

export type CarbCompositionHint = {
  carbType: "liquid_sugars" | "quick_refined" | "fruit" | "starchy" | "balanced" | "unsure";
  hasFat: boolean;
  hasProtein: boolean;
  hasFibre: boolean;
};

const p = (
  id: string,
  label: string,
  carbsGrams: number,
  uncertaintyPercent = 20,
): CarbPortion => ({ id, label, carbsGrams, uncertaintyPercent });

/**
 * Typical UK household portions for estimation only. Values intentionally use
 * ranges in the UI because brands, recipes and actual portions vary.
 */
export const CARB_FOODS: CarbFood[] = [
  {
    id: "porridge",
    name: "Porridge oats",
    aliases: ["oatmeal", "oats"],
    category: "breakfast",
    portions: [p("small", "Small bowl (30g dry oats)", 18, 15), p("regular", "Bowl (40g dry oats)", 24, 15), p("large", "Large bowl (60g dry oats)", 36, 15)],
  },
  {
    id: "breakfast-cereal",
    name: "Breakfast cereal",
    aliases: ["cornflakes", "rice cereal", "cereal"],
    category: "breakfast",
    portions: [p("small", "Small bowl (30g)", 24), p("regular", "Bowl (40g)", 32), p("large", "Large bowl (60g)", 48)],
  },
  {
    id: "granola",
    name: "Granola",
    aliases: ["muesli"],
    category: "breakfast",
    portions: [p("small", "Small serving (30g)", 19, 25), p("regular", "Serving (45g)", 29, 25), p("large", "Large serving (60g)", 38, 25)],
  },
  {
    id: "toast",
    name: "Bread or toast",
    aliases: ["bread", "white bread", "brown bread", "wholemeal toast"],
    category: "bread",
    portions: [p("one-slice", "1 medium slice", 15), p("two-slices", "2 medium slices", 30), p("thick-two", "2 thick slices", 40)],
  },
  {
    id: "bagel",
    name: "Bagel",
    aliases: ["plain bagel"],
    category: "bread",
    portions: [p("half", "Half a bagel", 24), p("regular", "1 bagel", 48), p("large", "1 large bagel", 60)],
  },
  {
    id: "wrap",
    name: "Tortilla wrap",
    aliases: ["tortilla", "flatbread"],
    category: "bread",
    portions: [p("small", "1 small wrap", 20), p("regular", "1 medium wrap", 30), p("large", "1 large wrap", 42)],
  },
  {
    id: "croissant",
    name: "Croissant",
    aliases: ["pastry"],
    category: "bread",
    portions: [p("mini", "1 mini croissant", 13, 25), p("regular", "1 croissant", 26, 25), p("large", "1 large croissant", 35, 25)],
  },
  {
    id: "rice",
    name: "Cooked rice",
    aliases: ["white rice", "brown rice", "basmati", "jasmine rice"],
    category: "staples",
    portions: [p("small", "Small serving (100g)", 28, 15), p("regular", "Serving (150g)", 42, 15), p("large", "Large serving (225g)", 63, 15)],
  },
  {
    id: "pasta",
    name: "Cooked pasta",
    aliases: ["spaghetti", "penne", "macaroni"],
    category: "staples",
    portions: [p("small", "Small serving (120g)", 36, 15), p("regular", "Serving (180g)", 54, 15), p("large", "Large serving (250g)", 75, 15)],
  },
  {
    id: "noodles",
    name: "Cooked noodles",
    aliases: ["egg noodles", "rice noodles"],
    category: "staples",
    portions: [p("small", "Small serving (120g)", 30), p("regular", "Serving (180g)", 45), p("large", "Large serving (250g)", 63)],
  },
  {
    id: "potato",
    name: "Baked potato",
    aliases: ["jacket potato", "baked spud"],
    category: "staples",
    portions: [p("small", "1 small (130g)", 22, 15), p("regular", "1 medium (180g)", 31, 15), p("large", "1 large (280g)", 48, 15)],
  },
  {
    id: "chips",
    name: "Chips",
    aliases: ["fries", "french fries"],
    category: "staples",
    portions: [p("small", "Small portion (100g)", 30, 25), p("regular", "Regular portion (160g)", 48, 25), p("large", "Large portion (220g)", 66, 25)],
  },
  {
    id: "apple",
    name: "Apple",
    aliases: ["apples"],
    category: "fruit",
    portions: [p("small", "1 small apple", 15, 15), p("regular", "1 medium apple", 20, 15), p("large", "1 large apple", 27, 15)],
  },
  {
    id: "banana",
    name: "Banana",
    aliases: ["bananas"],
    category: "fruit",
    portions: [p("small", "1 small banana", 20, 15), p("regular", "1 medium banana", 27, 15), p("large", "1 large banana", 35, 15)],
  },
  {
    id: "orange",
    name: "Orange",
    aliases: ["satsuma", "clementine"],
    category: "fruit",
    portions: [p("satsuma", "1 satsuma", 9, 15), p("regular", "1 medium orange", 15, 15), p("large", "1 large orange", 21, 15)],
  },
  {
    id: "grapes",
    name: "Grapes",
    aliases: ["grape"],
    category: "fruit",
    portions: [p("small", "Small handful (80g)", 14, 15), p("regular", "Handful (100g)", 18, 15), p("large", "Bowl (150g)", 27, 15)],
  },
  {
    id: "berries",
    name: "Mixed berries",
    aliases: ["strawberries", "blueberries", "raspberries"],
    category: "fruit",
    portions: [p("small", "Small handful (75g)", 6, 25), p("regular", "Bowl (150g)", 12, 25), p("large", "Large bowl (225g)", 18, 25)],
  },
  {
    id: "milk",
    name: "Milk",
    aliases: ["semi skimmed milk", "whole milk", "skimmed milk"],
    category: "dairy",
    portions: [p("splash", "Splash (50ml)", 2.5, 10), p("glass", "Glass (200ml)", 10, 10), p("large", "Large glass (300ml)", 15, 10)],
  },
  {
    id: "yogurt",
    name: "Yogurt",
    aliases: ["yoghurt", "fruit yogurt"],
    category: "dairy",
    portions: [p("plain", "Plain pot (125g)", 8, 30), p("fruit", "Fruit pot (125g)", 16, 30), p("large", "Large fruit pot (200g)", 26, 30)],
  },
  {
    id: "ice-cream",
    name: "Ice cream",
    aliases: ["gelato"],
    category: "dairy",
    portions: [p("one-scoop", "1 scoop", 13, 25), p("two-scoops", "2 scoops", 26, 25), p("bowl", "Large bowl", 40, 25)],
  },
  {
    id: "biscuit",
    name: "Sweet biscuit",
    aliases: ["cookie", "digestive", "hobnob"],
    category: "snacks",
    portions: [p("one", "1 biscuit", 8, 25), p("two", "2 biscuits", 16, 25), p("four", "4 biscuits", 32, 25)],
  },
  {
    id: "chocolate",
    name: "Chocolate",
    aliases: ["chocolate bar"],
    category: "snacks",
    portions: [p("small", "Small piece/bar (25g)", 14, 20), p("regular", "Regular bar (45g)", 25, 20), p("large", "Large bar (100g)", 56, 20)],
  },
  {
    id: "crisps",
    name: "Crisps",
    aliases: ["potato chips"],
    category: "snacks",
    portions: [p("small", "Small bag (25g)", 13, 15), p("regular", "Bag (40g)", 21, 15), p("sharing", "Half sharing bag (75g)", 39, 15)],
  },
  {
    id: "cereal-bar",
    name: "Cereal bar",
    aliases: ["granola bar", "snack bar"],
    category: "snacks",
    portions: [p("small", "1 small bar", 15, 25), p("regular", "1 regular bar", 22, 25), p("large", "1 large bar", 30, 25)],
  },
  {
    id: "cake",
    name: "Cake",
    aliases: ["sponge cake", "cupcake"],
    category: "snacks",
    portions: [p("small", "Small slice", 25, 30), p("regular", "Slice", 38, 30), p("large", "Large slice", 55, 30)],
  },
  {
    id: "fruit-juice",
    name: "Fruit juice",
    aliases: ["orange juice", "apple juice"],
    category: "drinks",
    portions: [p("small", "Small glass (150ml)", 15, 15), p("regular", "Glass (200ml)", 20, 15), p("large", "Large glass (300ml)", 30, 15)],
  },
  {
    id: "fizzy-drink",
    name: "Sugary fizzy drink",
    aliases: ["cola", "lemonade", "soda", "pop"],
    category: "drinks",
    portions: [p("can", "Can (330ml)", 35, 15), p("bottle", "Bottle (500ml)", 53, 15), p("pint", "Pint (568ml)", 60, 15)],
  },
  {
    id: "latte",
    name: "Latte",
    aliases: ["milky coffee", "cafe latte"],
    category: "drinks",
    portions: [p("small", "Small, unsweetened", 9, 25), p("regular", "Regular, unsweetened", 13, 25), p("large", "Large, unsweetened", 18, 25)],
  },
  {
    id: "sandwich",
    name: "Filled sandwich",
    aliases: ["sandwich", "packed lunch"],
    category: "meals",
    portions: [p("small", "Small, 2 thin slices", 30, 25), p("regular", "Regular sandwich", 40, 25), p("large", "Large or thick-cut", 55, 25)],
  },
  {
    id: "pizza",
    name: "Pizza",
    aliases: ["pizza slice"],
    category: "meals",
    portions: [p("slice", "1 medium slice", 30, 30), p("two-slices", "2 medium slices", 60, 30), p("half", "Half a medium pizza", 85, 30)],
  },
  {
    id: "curry-rice",
    name: "Curry with rice",
    aliases: ["indian curry", "chicken curry", "vegetable curry"],
    category: "meals",
    portions: [p("small", "Small plate", 60, 30), p("regular", "Regular plate", 85, 30), p("large", "Large plate/takeaway", 115, 30)],
  },
  {
    id: "fish-chips",
    name: "Fish and chips",
    aliases: ["fish supper", "chippy"],
    category: "meals",
    portions: [p("small", "Small portion", 65, 30), p("regular", "Regular portion", 90, 30), p("large", "Large portion", 120, 30)],
  },
  {
    id: "beans-toast",
    name: "Beans on toast",
    aliases: ["baked beans and toast"],
    category: "meals",
    portions: [p("one-slice", "Beans with 1 slice", 38, 25), p("regular", "Beans with 2 slices", 55, 25), p("large", "Large beans with 2 thick slices", 75, 25)],
  },
  {
    id: "sushi",
    name: "Sushi",
    aliases: ["maki", "sushi rolls"],
    category: "meals",
    portions: [p("small", "6 small pieces", 30, 30), p("regular", "8 pieces", 45, 30), p("large", "12 pieces", 68, 30)],
  },
  {
    id: "burrito",
    name: "Burrito",
    aliases: ["burrito bowl", "mexican wrap"],
    category: "meals",
    portions: [p("small", "Small burrito", 55, 30), p("regular", "Regular burrito", 80, 30), p("large", "Large burrito", 110, 30)],
  },
  {
    id: "full-english",
    name: "Full English breakfast",
    aliases: ["fry up", "cooked breakfast", "english breakfast"],
    category: "meals",
    portions: [p("small", "Small, 1 toast", 35, 30), p("regular", "Regular, 2 toast", 55, 30), p("large", "Large with hash browns", 80, 35)],
  },
  {
    id: "pancakes",
    name: "Pancakes with syrup",
    aliases: ["american pancakes", "pancake stack"],
    category: "meals",
    portions: [p("small", "2 pancakes", 40, 30), p("regular", "3 pancakes", 60, 30), p("large", "Large stack", 90, 35)],
  },
  {
    id: "eggs-toast",
    name: "Eggs on toast",
    aliases: ["scrambled eggs on toast", "poached eggs on toast"],
    category: "meals",
    portions: [p("one-slice", "Eggs with 1 slice", 17, 25), p("regular", "Eggs with 2 slices", 32, 25), p("large", "Eggs with 3 thick slices", 55, 30)],
  },
  {
    id: "soup-bread",
    name: "Soup with bread",
    aliases: ["soup and roll", "soup and toast"],
    category: "meals",
    portions: [p("small", "Cup with 1 slice", 25, 30), p("regular", "Bowl with bread roll", 45, 30), p("large", "Large bowl with 2 rolls", 70, 35)],
  },
  {
    id: "jacket-beans",
    name: "Jacket potato with beans",
    aliases: ["baked potato and beans", "jacket spud beans"],
    category: "meals",
    portions: [p("small", "Small potato, light beans", 45, 25), p("regular", "Medium potato with beans", 65, 25), p("large", "Large potato with beans", 90, 30)],
  },
  {
    id: "spaghetti-bolognese",
    name: "Spaghetti bolognese",
    aliases: ["spag bol", "pasta bolognese"],
    category: "meals",
    portions: [p("small", "Small bowl", 45, 25), p("regular", "Regular bowl", 65, 25), p("large", "Large bowl", 90, 30)],
  },
  {
    id: "lasagne",
    name: "Lasagne",
    aliases: ["lasagna"],
    category: "meals",
    portions: [p("small", "Small slice", 35, 30), p("regular", "Regular slice", 50, 30), p("large", "Large slice with garlic bread", 80, 35)],
  },
  {
    id: "macaroni-cheese",
    name: "Macaroni cheese",
    aliases: ["mac and cheese", "mac n cheese"],
    category: "meals",
    portions: [p("small", "Small bowl", 40, 30), p("regular", "Regular bowl", 60, 30), p("large", "Large bowl", 85, 35)],
  },
  {
    id: "stir-fry-noodles",
    name: "Stir-fry with noodles",
    aliases: ["noodle stir fry", "chow mein"],
    category: "meals",
    portions: [p("small", "Small plate", 45, 30), p("regular", "Regular plate", 65, 30), p("large", "Large plate/takeaway", 90, 35)],
  },
  {
    id: "stir-fry-rice",
    name: "Stir-fry with rice",
    aliases: ["rice stir fry", "chicken and rice"],
    category: "meals",
    portions: [p("small", "Small plate", 45, 30), p("regular", "Regular plate", 65, 30), p("large", "Large plate/takeaway", 95, 35)],
  },
  {
    id: "fried-rice",
    name: "Fried rice",
    aliases: ["egg fried rice", "special fried rice"],
    category: "meals",
    portions: [p("small", "Small side portion", 38, 25), p("regular", "Regular carton/plate", 65, 30), p("large", "Large carton", 90, 30)],
  },
  {
    id: "burger-fries",
    name: "Burger and fries",
    aliases: ["burger and chips", "cheeseburger meal"],
    category: "meals",
    portions: [p("small", "Small burger meal", 60, 30), p("regular", "Regular burger meal", 85, 30), p("large", "Large burger meal", 115, 35)],
  },
  {
    id: "kebab-wrap",
    name: "Kebab wrap",
    aliases: ["doner kebab", "chicken kebab wrap"],
    category: "meals",
    portions: [p("small", "Small wrap", 45, 30), p("regular", "Regular wrap", 65, 30), p("large", "Large wrap with chips", 105, 35)],
  },
  {
    id: "pie-mash",
    name: "Pie and mash",
    aliases: ["meat pie with mash", "chicken pie and mash"],
    category: "meals",
    portions: [p("small", "Small pie and mash", 55, 30), p("regular", "Regular plate", 75, 30), p("large", "Large plate", 100, 35)],
  },
  {
    id: "roast-dinner",
    name: "Roast dinner",
    aliases: ["sunday roast", "roast chicken dinner", "roast beef dinner"],
    category: "meals",
    portions: [p("small", "Small plate", 45, 35), p("regular", "Regular plate", 65, 35), p("large", "Large plate", 90, 40)],
  },
  {
    id: "ramen",
    name: "Ramen noodle bowl",
    aliases: ["ramen", "noodle soup"],
    category: "meals",
    portions: [p("small", "Small bowl", 45, 30), p("regular", "Regular bowl", 65, 30), p("large", "Large restaurant bowl", 90, 35)],
  },
  {
    id: "chilli-rice",
    name: "Chilli with rice",
    aliases: ["chilli con carne", "bean chilli and rice"],
    category: "meals",
    portions: [p("small", "Small bowl", 50, 30), p("regular", "Regular bowl", 70, 30), p("large", "Large bowl", 95, 35)],
  },
  {
    id: "shepherds-pie",
    name: "Shepherd's pie",
    aliases: ["cottage pie"],
    category: "meals",
    portions: [p("small", "Small serving", 30, 30), p("regular", "Regular serving", 45, 30), p("large", "Large serving", 65, 35)],
  },
  {
    id: "salad-grains",
    name: "Salad with grains",
    aliases: ["chicken grain salad", "quinoa salad", "couscous salad"],
    category: "meals",
    portions: [p("small", "Side salad", 20, 35), p("regular", "Main-meal bowl", 40, 35), p("large", "Large bowl with bread", 65, 40)],
  },
];

export const CARB_CATEGORY_LABELS: Record<CarbFoodCategory, string> = {
  breakfast: "Breakfast",
  bread: "Bread & bakery",
  staples: "Rice, pasta & potatoes",
  fruit: "Fruit",
  dairy: "Dairy",
  snacks: "Snacks",
  drinks: "Drinks",
  meals: "Meals & takeaway",
};

const hint = (
  carbType: CarbCompositionHint["carbType"],
  hasFat = false,
  hasProtein = false,
  hasFibre = false,
): CarbCompositionHint => ({ carbType, hasFat, hasProtein, hasFibre });

/** Composition hints drive Meal Adviser toggles; they never change the carb estimate. */
export const CARB_COMPOSITION_HINTS: Record<string, CarbCompositionHint> = {
  porridge: hint("starchy", false, false, true),
  "breakfast-cereal": hint("quick_refined"),
  granola: hint("quick_refined", true, false, true),
  toast: hint("quick_refined"),
  bagel: hint("quick_refined"),
  wrap: hint("quick_refined"),
  croissant: hint("quick_refined", true),
  rice: hint("starchy"),
  pasta: hint("starchy"),
  noodles: hint("starchy"),
  potato: hint("starchy", false, false, true),
  chips: hint("starchy", true),
  apple: hint("fruit", false, false, true),
  banana: hint("fruit", false, false, true),
  orange: hint("fruit", false, false, true),
  grapes: hint("fruit"),
  berries: hint("fruit", false, false, true),
  milk: hint("unsure", false, true),
  yogurt: hint("unsure", false, true),
  "ice-cream": hint("quick_refined", true, true),
  biscuit: hint("quick_refined", true),
  chocolate: hint("quick_refined", true),
  crisps: hint("starchy", true),
  "cereal-bar": hint("quick_refined", true),
  cake: hint("quick_refined", true),
  "fruit-juice": hint("liquid_sugars"),
  "fizzy-drink": hint("liquid_sugars"),
  latte: hint("liquid_sugars", false, true),
  sandwich: hint("balanced", true, true),
  pizza: hint("starchy", true, true),
  "curry-rice": hint("balanced", true, true, true),
  "fish-chips": hint("starchy", true, true),
  "beans-toast": hint("balanced", false, true, true),
  sushi: hint("balanced", false, true),
  burrito: hint("balanced", true, true, true),
  "full-english": hint("balanced", true, true),
  pancakes: hint("quick_refined", true, true),
  "eggs-toast": hint("balanced", true, true),
  "soup-bread": hint("balanced", false, false, true),
  "jacket-beans": hint("balanced", false, true, true),
  "spaghetti-bolognese": hint("balanced", true, true),
  lasagne: hint("starchy", true, true),
  "macaroni-cheese": hint("starchy", true, true),
  "stir-fry-noodles": hint("balanced", true, true, true),
  "stir-fry-rice": hint("balanced", true, true, true),
  "fried-rice": hint("starchy", true, true),
  "burger-fries": hint("starchy", true, true),
  "kebab-wrap": hint("balanced", true, true, true),
  "pie-mash": hint("starchy", true, true),
  "roast-dinner": hint("balanced", true, true, true),
  ramen: hint("balanced", true, true),
  "chilli-rice": hint("balanced", true, true, true),
  "shepherds-pie": hint("balanced", true, true, true),
  "salad-grains": hint("balanced", true, true, true),
};
