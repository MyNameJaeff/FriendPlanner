"use client";
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function Home() {

  const features = [
    {
      icon: '📅',
      title: 'Easy Scheduling',
      description: 'Coordinate with friends effortlessly. Find the perfect time that works for everyone in your group.'
    },
    {
      icon: '🗳️',
      title: 'Vote On Activities',
      description: 'Say goodbye to endless debates! Let your friends vote on activities and decide together.'
    },
    {
      icon: '🤝',
      title: 'Group Planning',
      description: 'Bring everyone together with collaborative planning tools designed for friendship and connection.'
    }
  ];

  return (
    <div className="min-h-screen relative overflow-hidden mt-6" style={{
      background: 'linear-gradient(135deg, #E6E6E6 0%, #C5A880 100%)'
    }}>
      {/* Floating Coffee Beans */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="absolute w-3 h-2 bg-amber-900 rounded-full opacity-10"
            style={{
              left: `${20 + i * 20}%`,
              animation: `float 6s ease-in-out infinite`,
              animationDelay: `${i}s`,
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div className="jetbrains-mono flex flex-col items-center justify-center min-h-screen p-8 relative z-10">
        {/* Title Section */}
        <h1 className="text-5xl md:text-6xl font-bold text-amber-900 text-center mb-4 drop-shadow-sm tracking-tight">
          Friend Planner
        </h1>
        <p className="text-xl md:text-2xl text-amber-900 text-center mb-12 opacity-80 italic">
          Plan Together, Connect Forever ☕
        </p>

        {/* Poster Container */}
        <div
          className="mb-12 transition-all duration-300 hover:scale-101"
        >
          <Image
            src="/FriendPlanner_Poster.png"
            alt="Friend Planner - Coffee cups arranged in a circle"
            width={384}
            height={512}
            className="w-80 md:w-96 h-auto rounded shadow-2xl border-4 border-white border-opacity-50"
            style={{
              boxShadow: '0 20px 40px rgba(83, 46, 28, 0.2), 0 10px 20px rgba(0, 0, 0, 0.1)'
            }}
            priority
          />
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col md:flex-row gap-6 mb-12">
          <Link href={"/planner"} className="px-8 py-4 rounded-full text-lg font-semibold text-gray-200 bg-gradient-to-r from-amber-900 to-black shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            Start Planning
          </Link>
          <Link
            href={"/about"}
            className="px-8 py-4 rounded-full text-lg font-semibold text-amber-900 bg-gray-200 bg-opacity-90 border-2 border-amber-600 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:bg-amber-600 hover:text-gray-200"
          >
            Learn More
          </Link>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl w-full">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white bg-opacity-70 backdrop-blur-lg p-8 rounded-3xl text-center shadow-lg border border-amber-600 border-opacity-30 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:bg-opacity-80"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-amber-600 to-amber-900 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-amber-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-amber-900 opacity-80 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Animated Coffee Cup */}
      <div
        className="fixed bottom-8 right-8 w-12 h-12 bg-amber-600 opacity-60 pointer-events-none"
        style={{
          borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
          animation: 'steam 2s ease-in-out infinite',
        }}
      />

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
        
        @keyframes steam {
          0%, 100% { transform: scale(1) rotate(0deg); }
          50% { transform: scale(1.1) rotate(5deg); }
        }
        
        @keyframes sparkle {
          0% { transform: scale(0); opacity: 0.7; }
          50% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0); opacity: 0; }
        }
      `}</style>
    </div >
  );
}