import { MapPin, Calendar, Users } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

interface ActivityCardProps {
  title: string;
  date: string;
  location: string;
  image: string;
  participants: number;
  index: number;
}

const ActivityCard = ({ title, date, location, image, participants, index }: ActivityCardProps) => {
  const [joined, setJoined] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="relative rounded-2xl overflow-hidden aspect-[4/3] group"
    >
      <img
        src={image}
        alt={title}
        loading="lazy"
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
        <h3 className="text-primary-foreground font-semibold text-base leading-tight">{title}</h3>
        <div className="flex items-center gap-3 text-primary-foreground/80 text-xs">
          <span className="flex items-center gap-1">
            <Calendar size={12} /> {date}
          </span>
          <span className="flex items-center gap-1">
            <MapPin size={12} /> {location}
          </span>
        </div>
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1 text-primary-foreground/70 text-xs">
            <Users size={12} />
            <span>{participants + (joined ? 1 : 0)} participants</span>
          </div>
          <button
            onClick={() => setJoined(!joined)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              joined
                ? "bg-accent text-accent-foreground"
                : "bg-primary-foreground/20 text-primary-foreground backdrop-blur-sm border border-primary-foreground/30"
            }`}
          >
            {joined ? "✓ Inscrit" : "Je participe"}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ActivityCard;
