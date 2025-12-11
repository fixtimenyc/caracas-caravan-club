import { useState } from "react";
import CarCard from "./CarCard";
import CategoryFilter from "./CategoryFilter";

import carSedan from "@/assets/car-sedan.jpg";
import carSuv from "@/assets/car-suv.jpg";
import carCompact from "@/assets/car-compact.jpg";
import carPickup from "@/assets/car-pickup.jpg";

const cars = [
  {
    id: "1",
    name: "Toyota Corolla 2022",
    image: carSedan,
    price: 45,
    rating: 4.9,
    reviews: 128,
    location: "Las Mercedes",
    seats: 5,
    transmission: "Automático",
    category: "sedan",
  },
  {
    id: "2",
    name: "Honda CR-V 2023",
    image: carSuv,
    price: 65,
    rating: 4.8,
    reviews: 89,
    location: "Altamira",
    seats: 5,
    transmission: "Automático",
    category: "suv",
  },
  {
    id: "3",
    name: "Chevrolet Spark 2021",
    image: carCompact,
    price: 28,
    rating: 4.7,
    reviews: 156,
    location: "Chacao",
    seats: 4,
    transmission: "Manual",
    category: "compact",
  },
  {
    id: "4",
    name: "Toyota Hilux 2022",
    image: carPickup,
    price: 85,
    rating: 4.9,
    reviews: 67,
    location: "El Hatillo",
    seats: 5,
    transmission: "Automático",
    category: "pickup",
  },
  {
    id: "5",
    name: "Hyundai Accent 2023",
    image: carSedan,
    price: 42,
    rating: 4.6,
    reviews: 94,
    location: "La Castellana",
    seats: 5,
    transmission: "Automático",
    category: "sedan",
  },
  {
    id: "6",
    name: "Kia Sportage 2022",
    image: carSuv,
    price: 70,
    rating: 4.8,
    reviews: 112,
    location: "Sabana Grande",
    seats: 5,
    transmission: "Automático",
    category: "suv",
  },
];

const FeaturedCars = () => {
  const [activeCategory, setActiveCategory] = useState("all");

  const filteredCars = activeCategory === "all" 
    ? cars 
    : cars.filter(car => car.category === activeCategory);

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Vehículos destacados
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Explora nuestra selección de vehículos verificados disponibles en Caracas
          </p>
        </div>

        {/* Category Filter */}
        <div className="mb-10">
          <CategoryFilter
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />
        </div>

        {/* Cars Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCars.map((car, index) => (
            <div
              key={car.id}
              className="animate-scale-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CarCard car={car} />
            </div>
          ))}
        </div>

        {/* View All Button */}
        <div className="text-center mt-12">
          <button className="px-8 py-3 bg-secondary text-secondary-foreground rounded-xl font-semibold hover:bg-secondary/80 transition-smooth">
            Ver todos los vehículos
          </button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedCars;
