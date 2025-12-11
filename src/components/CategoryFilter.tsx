import { Car, Truck, Zap } from "lucide-react";

interface Category {
  id: string;
  name: string;
  icon: React.ReactNode;
  count: number;
}

const categories: Category[] = [
  { id: "sedan", name: "Sedán", icon: <Car className="w-6 h-6" />, count: 124 },
  { id: "suv", name: "SUV", icon: <Car className="w-6 h-6" />, count: 89 },
  { id: "compact", name: "Compacto", icon: <Zap className="w-6 h-6" />, count: 156 },
  { id: "pickup", name: "Camioneta", icon: <Truck className="w-6 h-6" />, count: 67 },
];

interface CategoryFilterProps {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

const CategoryFilter = ({ activeCategory, onCategoryChange }: CategoryFilterProps) => {
  return (
    <div className="flex flex-wrap gap-3 justify-center">
      <button
        onClick={() => onCategoryChange("all")}
        className={`px-5 py-3 rounded-xl font-medium text-sm transition-smooth flex items-center gap-2 ${
          activeCategory === "all"
            ? "bg-primary text-primary-foreground shadow-card"
            : "bg-card text-muted-foreground hover:bg-secondary hover:text-secondary-foreground border border-border"
        }`}
      >
        Todos
        <span className="text-xs opacity-70">436</span>
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => onCategoryChange(category.id)}
          className={`px-5 py-3 rounded-xl font-medium text-sm transition-smooth flex items-center gap-2 ${
            activeCategory === category.id
              ? "bg-primary text-primary-foreground shadow-card"
              : "bg-card text-muted-foreground hover:bg-secondary hover:text-secondary-foreground border border-border"
          }`}
        >
          {category.icon}
          {category.name}
          <span className="text-xs opacity-70">{category.count}</span>
        </button>
      ))}
    </div>
  );
};

export default CategoryFilter;
