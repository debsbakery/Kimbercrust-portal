'use client';

export default function ARActions({ customers }: { customers: any[] }) {
  return (
    <div className="flex gap-2">
      <button className="px-4 py-2 bg-green-600 text-white rounded">
        Actions
      </button>
    </div>
  );
}