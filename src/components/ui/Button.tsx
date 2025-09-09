import React from "react";


export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = "", ...props }) => (
<button
className={`px-4 py-2 rounded-2xl shadow-sm border border-neutral-300 hover:shadow transition disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
{...props}
/>
);
