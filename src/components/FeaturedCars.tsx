import { useEffect, useState } from "react";
import CarCard from "./CarCard";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
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
  const pub = supabase.storage.from("vehicle-photos").getPublicUrl(path);
  try {
    const head = await fetch(pub.data.publicUrl, { method: "HEAD" });
    if (head.ok) return pub.data.publicUrl;
  } catch {}
  const { data: signed } = await supabase.storage
    .from("owner-documents")
    .createSignedUrl(path, 60 * 60);
  return signed?.signedUrl || carPlaceholder;
};

const FeaturedCars = () => {
  const [cars, setCars] = useState<CardCar[]>([]);
  const [loading, setLoading] = useState(true);

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

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : cars.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            No hay vehículos disponibles en este momento.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {cars.slice(0, 9).map((car, index) => (
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
