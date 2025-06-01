'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const links = [
    { href: '/', label: 'HOME' },
    { href: '/planner', label: 'PLANNER' },
    { href: '/about', label: 'ABOUT' },
    { href: '/contact', label: 'CONTACT' },
];

export default function Navbar() {
    const pathname = usePathname();
    const [show, setShow] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);

    useEffect(() => {
        const handleScroll = () => {
            const currentY = window.scrollY;
            setShow(currentY < lastScrollY || currentY < 50);
            setLastScrollY(currentY);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastScrollY]);

    return (
        <nav
            className={`fixed top-0 w-full transition-transform duration-300 z-50 bg-[#532E1C] text-white ${show ? "translate-y-0" : "-translate-y-full"
                }`}
        >
            <div className="max-w-full mx-auto px-4 py-3">
                <div className="flex items-center">
                    <Link className="relative w-24 h-12 flex-shrink-0" href="/">
                        <Image
                            src="/FriendPlanner_Logo.png"
                            alt="Logo"
                            fill
                            className="object-contain"
                            sizes="100vw"
                        />
                    </Link>
                    <div className="flex items-center space-x-24 ml-auto mr-16">
                        {links.map(({ href, label }) => (
                            <Link
                                key={href}
                                href={href}
                                className={`hover:text-gray-300 sue-ellen-francisco tracking-widest text-lg text-[#DDA853] font-bold ${pathname === href ? "underline" : ""
                                    }`}
                            >
                                {label}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </nav >
    );
}