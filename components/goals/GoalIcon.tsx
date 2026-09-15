import { Beef, BookOpen, Brain, Check, Coffee, Droplets, Dumbbell, Flame, Footprints, Utensils } from "lucide-react";
import type { GoalIconName } from "@/lib/goal-data";

const icons = {
  gym: Dumbbell,
  study: BookOpen,
  brain: Brain,
  calories: Utensils,
  protein: Beef,
  steps: Footprints,
  tea: Coffee,
  water: Droplets,
  check: Check,
  flame: Flame,
};

export function GoalIcon({ name, className = "size-[18px]" }: { name: GoalIconName; className?: string }) {
  const Icon = icons[name];
  return <Icon className={className} />;
}
