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
