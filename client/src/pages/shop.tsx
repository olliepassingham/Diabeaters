import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ShoppingCart, Search, Star, Package, Heart } from "lucide-react";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  rating: number;
  reviews: number;
  inStock: boolean;
  badge?: string;
}

const products: Product[] = [
  {
    id: "1",
    name: "Dextro Energy Tablets",
    description: "Fast-acting glucose tablets for treating hypos. Lemon flavour, 14 tablets per pack.",
    price: 2.49,
    category: "hypo-treatment",
    rating: 4.8,
    reviews: 324,
    inStock: true,
    badge: "Best Seller",
  },
  {
    id: "2",
    name: "Glucotabs Raspberry",
    description: "Chewable glucose tablets with great taste. Quick absorption for hypo treatment.",
    price: 3.29,
    category: "hypo-treatment",
    rating: 4.6,
    reviews: 189,
    inStock: true,
  },
  {
    id: "3",
    name: "Lift Glucose Shots",
    description: "Liquid glucose in convenient sachets. 15g fast-acting carbs per shot.",
    price: 4.99,
    category: "hypo-treatment",
    rating: 4.7,
    reviews: 156,
    inStock: true,
  },
  {
    id: "4",
    name: "Jelly Babies (Small Bag)",
    description: "Classic hypo treatment. Approx 5g carbs per sweet, easy to carry.",
    price: 1.50,
    category: "hypo-treatment",
    rating: 4.5,
    reviews: 412,
    inStock: true,
  },
  {
    id: "5",
    name: "Libre 3 Sensor Patches (10 Pack)",
    description: "Adhesive overlay patches to extend sensor wear time. Waterproof and skin-friendly.",
    price: 12.99,
    category: "cgm-accessories",
    rating: 4.4,
    reviews: 287,
    inStock: true,
    badge: "Popular",
  },
  {
    id: "6",
    name: "Dexcom G7 Overpatch",
    description: "Protective adhesive covers for Dexcom G7 sensors. Pack of 20.",
    price: 14.99,
    category: "cgm-accessories",
    rating: 4.6,
    reviews: 198,
    inStock: true,
  },
  {
    id: "7",
    name: "CGM Sensor Arm Band",
    description: "Adjustable compression band for extra sensor security during sports.",
    price: 8.99,
    category: "cgm-accessories",
    rating: 4.3,
    reviews: 145,
    inStock: true,
  },
  {
    id: "8",
    name: "SkinTac Adhesive Wipes",
    description: "Barrier wipes to improve sensor adhesion. Box of 50 wipes.",
    price: 16.99,
    category: "cgm-accessories",
    rating: 4.7,
    reviews: 234,
    inStock: true,
  },
  {
    id: "9",
    name: "Grenade Carb Killa Bar",
    description: "High protein, low sugar bar. 23g protein, only 1.4g sugar per bar.",
    price: 2.99,
    category: "food",
    rating: 4.5,
    reviews: 567,
    inStock: true,
  },
  {
    id: "10",
    name: "PhD Smart Bar (Box of 12)",
    description: "Low carb protein bars with great macros. 20g protein per bar.",
    price: 24.99,
    category: "food",
    rating: 4.4,
    reviews: 345,
    inStock: true,
    badge: "Value Pack",
  },
  {
    id: "11",
    name: "Atkins Chocolate Crisp Bars",
    description: "Low carb snack bars. Only 2g net carbs per bar.",
    price: 5.99,
    category: "food",
    rating: 4.2,
    reviews: 223,
    inStock: true,
  },
  {
    id: "12",
    name: "Hilo Life Keto Crisps",
    description: "Crunchy low carb snack. 3g carbs per serving, high in protein.",
    price: 4.49,
    category: "food",
    rating: 4.1,
    reviews: 178,
    inStock: true,
  },
  {
    id: "13",
    name: "Insulin Cooling Wallet",
    description: "Reusable cooling case for insulin pens. Keeps cool for up to 45 hours.",
    price: 29.99,
    category: "accessories",
    rating: 4.8,
    reviews: 312,
    inStock: true,
    badge: "Essential",
  },
  {
    id: "14",
    name: "Diabetes Supply Organiser Bag",
    description: "Compact bag with compartments for insulin, test strips, lancets and more.",
    price: 18.99,
    category: "accessories",
    rating: 4.6,
    reviews: 267,
    inStock: true,
  },
  {
    id: "16",
    name: "Medical ID Bracelet",
    description: "Stainless steel diabetic alert bracelet. Adjustable size, engraved.",
    price: 12.99,
    category: "accessories",
    rating: 4.5,
    reviews: 423,
    inStock: true,
  },
];

const categories = [
  { id: "all", label: "All Products" },
  { id: "hypo-treatment", label: "Hypo Treatment" },
  { id: "cgm-accessories", label: "CGM Accessories" },
  { id: "food", label: "Food & Snacks" },
  { id: "accessories", label: "Accessories" },
];

export default function Shop() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [cart, setCart] = useState<{ id: string; quantity: number }[]>([]);

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const addToCart = (productId: string) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === productId);
      if (existing) {
        return prev.map((item) =>
          item.id === productId ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { id: productId, quantity: 1 }];
    });
  };

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.id);
    return sum + (product?.price || 0) * item.quantity;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Shop</h1>
          <p className="text-muted-foreground">
            Essential diabetes supplies delivered to your door
          </p>
        </div>
        <Button variant="outline" className="relative" data-testid="button-cart">
          <ShoppingCart className="h-4 w-4 mr-2" />
          Basket
          {cartItemCount > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
              {cartItemCount}
            </Badge>
          )}
        </Button>
      </div>

      <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <Package className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">Prototype Preview</p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                This shop is a preview of what will be available. Full purchasing functionality coming soon.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>
      </div>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {categories.map((category) => (
            <TabsTrigger
              key={category.id}
              value={category.id}
              data-testid={`tab-${category.id}`}
            >
              {category.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((category) => (
          <TabsContent key={category.id} value={category.id} className="mt-6 animate-fade-in-up">
            {filteredProducts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No products found matching your search.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredProducts.map((product) => (
                  <Card key={product.id} className="flex flex-col" data-testid={`card-product-${product.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base leading-tight">{product.name}</CardTitle>
                        {product.badge && (
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            {product.badge}
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-sm line-clamp-2">
                        {product.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 pb-3">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        <span>{product.rating}</span>
                        <span className="mx-1">-</span>
                        <span>{product.reviews} reviews</span>
                      </div>
                    </CardContent>
                    <CardFooter className="flex items-center justify-between gap-2 pt-0">
                      <span className="text-lg font-semibold">
                        {"\u00A3"}{product.price.toFixed(2)}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          data-testid={`button-wishlist-${product.id}`}
                        >
                          <Heart className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => addToCart(product.id)}
                          data-testid={`button-add-${product.id}`}
                        >
                          Add
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {cartItemCount > 0 && (
        <Card className="fixed bottom-4 right-4 w-72 shadow-lg z-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Your Basket
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="space-y-1 text-sm">
              {cart.map((item) => {
                const product = products.find((p) => p.id === item.id);
                if (!product) return null;
                return (
                  <div key={item.id} className="flex justify-between">
                    <span className="truncate max-w-[180px]">
                      {item.quantity}x {product.name}
                    </span>
                    <span>{"\u00A3"}{(product.price * item.quantity).toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
            <div className="border-t mt-3 pt-3 flex justify-between font-medium">
              <span>Total</span>
              <span>{"\u00A3"}{cartTotal.toFixed(2)}</span>
            </div>
          </CardContent>
          <CardFooter className="pt-0">
            <Button className="w-full" data-testid="button-checkout">
              Checkout (Coming Soon)
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
