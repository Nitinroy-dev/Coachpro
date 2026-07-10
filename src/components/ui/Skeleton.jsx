import React from 'react'

export default function Skeleton({ className = '', count = 1 }) {
  return (
    <>
      {Array(count).fill(0).map((_, idx) => (
        <div
          key={idx}
          className={`bg-gray-200/60 rounded-xl animate-pulse ${className}`}
        />
      ))}
    </>
  )
}

export function TableRowSkeleton({ cols = 5, rows = 4 }) {
  return (
    <div className="space-y-2.5">
      {Array(rows).fill(0).map((_, rIdx) => (
        <div key={rIdx} className="flex gap-4 p-4 border border-gray-100/80 rounded-2xl animate-pulse bg-white items-center justify-between">
          <div className="w-9 h-9 rounded-full bg-gray-200" />
          <div className="h-4 bg-gray-200 rounded-md w-24" />
          <div className="h-4 bg-gray-200 rounded-md w-32 hidden sm:block" />
          <div className="h-4 bg-gray-200 rounded-md w-16" />
          <div className="h-4 bg-gray-200 rounded-md w-20 hidden md:block" />
          <div className="h-6 bg-gray-200 rounded-lg w-12" />
        </div>
      ))}
    </div>
  )
}

export function GridCardSkeleton({ count = 3 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array(count).fill(0).map((_, idx) => (
        <div key={idx} className="p-5 border border-gray-100 bg-white rounded-2xl animate-pulse space-y-4">
          <div className="flex gap-3 items-center">
            <div className="w-11 h-11 bg-gray-200 rounded-xl" />
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-gray-200 rounded-md w-3/4" />
              <div className="h-3 bg-gray-200 rounded-md w-1/3" />
            </div>
          </div>
          <div className="h-10 bg-gray-100 rounded-xl w-full" />
          <div className="flex gap-2">
            <div className="h-10 bg-gray-100 rounded-xl flex-1" />
            <div className="h-10 bg-gray-100 rounded-xl flex-1" />
          </div>
        </div>
      ))}
    </div>
  )
}
