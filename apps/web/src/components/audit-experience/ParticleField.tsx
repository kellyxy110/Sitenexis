'use client';

/** Ambient background particles. Skipped entirely under prefers-reduced-motion rather than just slowed. */
export function ParticleField({ reducedMotion }: { reducedMotion: boolean }) {
  if (reducedMotion) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: 30 }, (_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-cyan/20"
          style={{
            width: `${1 + Math.random() * 2}px`,
            height: `${1 + Math.random() * 2}px`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `particleFloat ${8 + Math.random() * 12}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 8}s`,
            opacity: 0.3 + Math.random() * 0.4,
          }}
        />
      ))}
      <style>{`
        @keyframes particleFloat {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
          25%      { transform: translateY(-20px) translateX(10px); opacity: 0.6; }
          50%      { transform: translateY(-10px) translateX(-5px); opacity: 0.4; }
          75%      { transform: translateY(-30px) translateX(8px); opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
