
export default function Footer() {
    return (
        <footer className="flex items-center justify-center p-4 bg-[#0F0F0F] text-white">
            <p className="text-sm">
                &copy; {new Date().getFullYear()} Friend Planner. All rights reserved.
            </p>
        </footer>
    );
}