import { Heart, MapPin, Star, Users } from "lucide-react";
import { useState } from "react";

interface CarCardProps {
  car: {
    id: string;
    name: string;
    image: string;
    price: number;
    rating: number;
    reviews: number;
    location: string;
    seats: number;
    transmission: string;
    isFavorite?: boolean;
  };
}

const CarCard = ({ car }: CarCardProps) => {
  const [isFavorite, setIsFavorite] = useState(car.isFavorite || false);

  return (
    <div className="group bg-card rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover transition-smooth cursor-pointer">
      {/* Image Container */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={car.image}
          alt={car.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-smooth"
        />
        
        {/* Favorite Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsFavorite(!isFavorite);
          }}
          className="absolute top-3 right-3 w-10 h-10 bg-card/80 backdrop-blur-sm rounded-full flex items-center justify-center transition-smooth hover:bg-card"
        >
          <Heart
            className={`w-5 h-5 transition-smooth ${
              isFavorite ? "fill-accent text-accent" : "text-muted-foreground"
            }`}
          />
        </button>

        {/* Price Tag */}
        <div className="absolute bottom-3 left-3 bg-card/90 backdrop-blur-sm rounded-lg px-3 py-1.5">
          <span className="text-lg font-bold text-foreground">${car.price}</span>
          <span className="text-xs text-muted-foreground">/día</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Name and Rating */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="font-semibold text-foreground text-lg leading-tight group-hover:text-primary transition-smooth">
            {car.name}
          </h3>
          <div className="flex items-center gap-1 shrink-0">
            <Star className="w-4 h-4 fill-accent text-accent" />
            <span className="text-sm font-medium text-foreground">{car.rating}</span>
            <span className="text-xs text-muted-foreground">({car.reviews})</span>
          </div>
        </div>

        {/* Details */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4" />
            <span>{car.location}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            <span>{car.seats} asientos</span>
          </div>
        </div>

        {/* Transmission Badge */}
        <div className="mt-3">
          <span className="inline-block px-2.5 py-1 bg-secondary text-secondary-foreground text-xs font-medium rounded-md">
            {car.transmission}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CarCard;
