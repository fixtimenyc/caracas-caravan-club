import { useEffect, useMemo, useState } from "react";
import CarCard from "./CarCard";
import CategoryFilter from "./CategoryFilter";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MapPin, DollarSign } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { inferCategory, VehicleCategory } from "@/lib/vehicleCategory";

import carPlaceholder from "@/assets/car-sedan.jpg";

interface VehicleRow {
  id: string;
  brand: string;
  model: string;
  year: number;
  location: string;
  price_per_day: number;
  photos: string[] | null;
}

interface CardCar {
  id: string;
  name: string;
  image: string;
  price: number;
  rating: number;
  reviews: number;
  location: string;
  seats: number;
  transmission: string;
  category: VehicleCategory;
}

const resolvePhoto = async (path?: string | null): Promise<string> => {
  if (!path) return carPlaceholder;
  if (path.startsWith("http")) return path;
  // Try public bucket first
  const pub = supabase.storage.from("vehicle-photos").getPublicUrl(path);
  try {
    const head = await fetch(pub.data.publicUrl, { method: "HEAD" });
    if (head.ok) return pub.data.publicUrl;
  } catch {}
  // Fallback: signed URL from private owner-documents bucket
  const { data: signed } = await supabase.storage
    .from("owner-documents")
    .createSignedUrl(path, 60 * 60);
  return signed?.signedUrl || carPlaceholder;
};

const PRICE_MAX = 200;

const FeaturedCars = () => {
  const [cars, setCars] = useState<CardCar[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeCategory, setActiveCategory] = useState("all");
  const [city, setCity] = useState<string>("all");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, PRICE_MAX]);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, brand, model, year, location, price_per_day, photos")
        .eq("active", true)
        .eq("available", true)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error || !data) {
        setLoading(false);
        return;
      }

      const enriched = await Promise.all(
        (data as VehicleRow[]).map(async (v) => {
          const [{ data: rating }, image] = await Promise.all([
            supabase.rpc("vehicle_rating_summary", { _vehicle_id: v.id }),
            resolvePhoto(v.photos?.[0]),
          ]);
          const summary = rating?.[0];
          return {
            id: v.id,
            name: `${v.brand.trim()} ${v.model} ${v.year}`,
            image,
            price: Number(v.price_per_day),
            rating: summary?.avg_rating ? Number(summary.avg_rating) : 0,
            reviews: summary?.review_count ? Number(summary.review_count) : 0,
            location: v.location,
            seats: 5,
            transmission: "Automático",
            category: inferCategory(v.brand, v.model),
          } as CardCar;
        })
      );

      setCars(enriched);
      setLoading(false);
    };

    load();
  }, []);

  const cities = useMemo(() => {
    const set = new Set(cars.map((c) => c.location).filter(Boolean));
    return Array.from(set).sort();
  }, [cars]);

  const filteredCars = useMemo(() => {
    return cars.filter((c) => {
      if (activeCategory !== "all" && c.category !== activeCategory) return false;
      if (city !== "all" && c.location !== city) return false;
      if (c.price < priceRange[0] || c.price > priceRange[1]) return false;
      return true;
    });
  }, [cars, activeCategory, city, priceRange]);

  const categoryCounts = useMemo(() => {
    const base = cars.filter((c) => {
      if (city !== "all" && c.location !== city) return false;
      if (c.price < priceRange[0] || c.price > priceRange[1]) return false;
      return true;
    });
    return base.reduce<Record<string, number>>((acc, c) => {
      acc[c.category] = (acc[c.category] ?? 0) + 1;
      return acc;
    }, {});
  }, [cars, city, priceRange]);

  const totalForCategory = useMemo(
    () =>
      cars.filter((c) => {
        if (city !== "all" && c.location !== city) return false;
        if (c.price < priceRange[0] || c.price > priceRange[1]) return false;
        return true;
      }).length,
    [cars, city, priceRange]
  );

  const resetFilters = () => {
    setActiveCategory("all");
    setCity("all");
    setPriceRange([0, PRICE_MAX]);
  };

  const filtersActive = activeCategory !== "all" || city !== "all" || priceRange[0] !== 0 || priceRange[1] !== PRICE_MAX;

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Vehículos destacados
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Explora nuestra selección de vehículos verificados disponibles en Caracas
          </p>
        </div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-2xl p-5 mb-8 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            {/* City */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                <MapPin className="w-4 h-4 text-primary" /> Ciudad / Zona
              </label>
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las zonas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las zonas</SelectItem>
                  {cities.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Price */}
            <div>
              <label className="flex items-center justify-between text-sm font-medium text-foreground mb-2">
                <span className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" /> Precio por día
                </span>
                <span className="text-muted-foreground font-normal">
                  ${priceRange[0]} – ${priceRange[1]}{priceRange[1] === PRICE_MAX ? "+" : ""}
                </span>
              </label>
              <Slider
                value={priceRange}
                onValueChange={(v) => setPriceRange([v[0], v[1]] as [number, number])}
                min={0}
                max={PRICE_MAX}
                step={5}
                className="mt-3"
              />
            </div>
          </div>

          <CategoryFilter
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            counts={categoryCounts}
            totalCount={totalForCategory}
          />

          {filtersActive && (
            <div className="flex justify-center mt-4">
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Limpiar filtros
              </Button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredCars.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            No hay vehículos que coincidan con los filtros seleccionados.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCars.slice(0, 9).map((car, index) => (
              <div
                key={car.id}
                className="animate-scale-in"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <CarCard car={car} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default FeaturedCars;
