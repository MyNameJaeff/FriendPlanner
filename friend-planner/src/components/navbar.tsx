'use client';

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
        <nav className={`fixed top-0 w-full transition-transform duration-300 z-50 bg-blue-500 text-white ${show ? 'translate-y-0' : '-translate-y-full'}`}>
            <div className="max-w-6xl mx-auto px-4 py-3">
                <ul className="flex justify-between items-center">
                    {links.map(({ href, label }) => (
                        <li key={href}>
                            <Link
                                href={href}
                                className={`hover:text-gray-300 ${pathname === href ? 'underline font-bold' : ''}`}
                            >
                                {label}
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>
        </nav>
    );
}
