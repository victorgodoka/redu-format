"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createDrawer } from "./draw";

const ON_SCREEN = 3;

type Pose = { src: string; top: number; left: number; size: number };

// Keeps clear of the headline column on the left.
function randomPose(src: string): Pose {
  return {
    src,
    top: 6 + Math.random() * 64,
    left: 48 + Math.random() * 38,
    size: 140 + Math.random() * 90,
  };
}

function Floater({ draw, delay }: { draw: () => string; delay: number }) {
  const [pose, setPose] = useState<Pose | null>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Move while invisible, then fade back in somewhere else.
    // Reduced motion draws once and stays put.
    const show = () => {
      setPose(randomPose(draw()));
      setOn(true);
      if (!still) timer = setTimeout(hide, 3600);
    };
    const hide = () => {
      setOn(false);
      timer = setTimeout(show, 1400);
    };

    timer = setTimeout(show, delay);
    return () => clearTimeout(timer);
  }, [draw, delay]);

  if (!pose) return null;

  return (
    <div
      className="floater"
      data-on={on}
      style={{
        top: `${pose.top}%`,
        left: `${pose.left}%`,
        width: pose.size,
        height: pose.size,
      }}
    >
      <Image src={pose.src} alt="" fill sizes="240px" />
    </div>
  );
}

export default function DeckArt({ images }: { images: string[] }) {
  // One deck shared by every floater, so the no-repeat run spans all of them.
  const [draw] = useState(() => createDrawer(images, ON_SCREEN));

  if (images.length === 0) return null;

  return (
    <div className="floaters" aria-hidden="true">
      {Array.from({ length: Math.min(ON_SCREEN, images.length) }, (_, i) => (
        <Floater key={i} draw={draw} delay={i * 1600} />
      ))}
    </div>
  );
}
