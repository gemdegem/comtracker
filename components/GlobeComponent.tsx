'use client'
import React from 'react'
import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import Link from 'next/link'

const World = dynamic(() => import('./ui/globe').then((m) => m.World), {
	ssr: false,
})

export function GlobeComponent() {
	const globeConfig = {
		pointSize: 4,
		globeColor: '#13213e',
		showAtmosphere: true,
		atmosphereColor: '#FFFFFF',
		atmosphereAltitude: 0.1,
		emissive: '#13213e',
		emissiveIntensity: 0.1,
		shininess: 0.9,
		polygonColor: 'rgba(255,255,255,0.7)',
		ambientLight: '#38bdf8',
		directionalLeftLight: '#ffffff',
		directionalTopLight: '#ffffff',
		pointLight: '#ffffff',
		arcTime: 1000,
		arcLength: 0.9,
		rings: 1,
		maxRings: 3,
		initialPosition: { lat: 22.3193, lng: 114.1694 },
		autoRotate: true,
		autoRotateSpeed: 0.5,
	}
	const colors = ['#06b6d4', '#3b82f6', '#6366f1']
	const sampleArcs = [
		{
			order: 1,
			startLat: -19.885592,
			startLng: -43.951191,
			endLat: -22.9068,
			endLng: -43.1729,
			arcAlt: 0.1,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 1,
			startLat: 28.6139,
			startLng: 77.209,
			endLat: 3.139,
			endLng: 101.6869,
			arcAlt: 0.2,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 1,
			startLat: -19.885592,
			startLng: -43.951191,
			endLat: -1.303396,
			endLng: 36.852443,
			arcAlt: 0.5,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 2,
			startLat: 1.3521,
			startLng: 103.8198,
			endLat: 35.6762,
			endLng: 139.6503,
			arcAlt: 0.2,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 2,
			startLat: 51.5072,
			startLng: -0.1276,
			endLat: 3.139,
			endLng: 101.6869,
			arcAlt: 0.3,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 2,
			startLat: -15.785493,
			startLng: -47.909029,
			endLat: 36.162809,
			endLng: -115.119411,
			arcAlt: 0.3,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 3,
			startLat: -33.8688,
			startLng: 151.2093,
			endLat: 22.3193,
			endLng: 114.1694,
			arcAlt: 0.3,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 3,
			startLat: 21.3099,
			startLng: -157.8581,
			endLat: 40.7128,
			endLng: -74.006,
			arcAlt: 0.3,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 3,
			startLat: -6.2088,
			startLng: 106.8456,
			endLat: 51.5072,
			endLng: -0.1276,
			arcAlt: 0.3,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 4,
			startLat: 11.986597,
			startLng: 8.571831,
			endLat: -15.595412,
			endLng: -56.05918,
			arcAlt: 0.5,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 4,
			startLat: -34.6037,
			startLng: -58.3816,
			endLat: 22.3193,
			endLng: 114.1694,
			arcAlt: 0.7,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 4,
			startLat: 51.5072,
			startLng: -0.1276,
			endLat: 48.8566,
			endLng: -2.3522,
			arcAlt: 0.1,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 5,
			startLat: 14.5995,
			startLng: 120.9842,
			endLat: 51.5072,
			endLng: -0.1276,
			arcAlt: 0.3,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 5,
			startLat: 1.3521,
			startLng: 103.8198,
			endLat: -33.8688,
			endLng: 151.2093,
			arcAlt: 0.2,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 5,
			startLat: 34.0522,
			startLng: -118.2437,
			endLat: 48.8566,
			endLng: -2.3522,
			arcAlt: 0.2,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 6,
			startLat: -15.432563,
			startLng: 28.315853,
			endLat: 1.094136,
			endLng: -63.34546,
			arcAlt: 0.7,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 6,
			startLat: 37.5665,
			startLng: 126.978,
			endLat: 35.6762,
			endLng: 139.6503,
			arcAlt: 0.1,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 6,
			startLat: 22.3193,
			startLng: 114.1694,
			endLat: 51.5072,
			endLng: -0.1276,
			arcAlt: 0.3,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 7,
			startLat: -19.885592,
			startLng: -43.951191,
			endLat: -15.595412,
			endLng: -56.05918,
			arcAlt: 0.1,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 7,
			startLat: 48.8566,
			startLng: -2.3522,
			endLat: 52.52,
			endLng: 13.405,
			arcAlt: 0.1,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 7,
			startLat: 52.52,
			startLng: 13.405,
			endLat: 34.0522,
			endLng: -118.2437,
			arcAlt: 0.2,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 8,
			startLat: -8.833221,
			startLng: 13.264837,
			endLat: -33.936138,
			endLng: 18.436529,
			arcAlt: 0.2,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 8,
			startLat: 49.2827,
			startLng: -123.1207,
			endLat: 52.3676,
			endLng: 4.9041,
			arcAlt: 0.2,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 8,
			startLat: 1.3521,
			startLng: 103.8198,
			endLat: 40.7128,
			endLng: -74.006,
			arcAlt: 0.5,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 9,
			startLat: 51.5072,
			startLng: -0.1276,
			endLat: 34.0522,
			endLng: -118.2437,
			arcAlt: 0.2,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 9,
			startLat: 22.3193,
			startLng: 114.1694,
			endLat: -22.9068,
			endLng: -43.1729,
			arcAlt: 0.7,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 9,
			startLat: 1.3521,
			startLng: 103.8198,
			endLat: -34.6037,
			endLng: -58.3816,
			arcAlt: 0.5,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 10,
			startLat: -22.9068,
			startLng: -43.1729,
			endLat: 28.6139,
			endLng: 77.209,
			arcAlt: 0.7,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 10,
			startLat: 34.0522,
			startLng: -118.2437,
			endLat: 31.2304,
			endLng: 121.4737,
			arcAlt: 0.3,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 10,
			startLat: -6.2088,
			startLng: 106.8456,
			endLat: 52.3676,
			endLng: 4.9041,
			arcAlt: 0.3,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 11,
			startLat: 41.9028,
			startLng: 12.4964,
			endLat: 34.0522,
			endLng: -118.2437,
			arcAlt: 0.2,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 11,
			startLat: -6.2088,
			startLng: 106.8456,
			endLat: 31.2304,
			endLng: 121.4737,
			arcAlt: 0.2,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 11,
			startLat: 22.3193,
			startLng: 114.1694,
			endLat: 1.3521,
			endLng: 103.8198,
			arcAlt: 0.2,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 12,
			startLat: 34.0522,
			startLng: -118.2437,
			endLat: 37.7749,
			endLng: -122.4194,
			arcAlt: 0.1,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 12,
			startLat: 35.6762,
			startLng: 139.6503,
			endLat: 22.3193,
			endLng: 114.1694,
			arcAlt: 0.2,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 12,
			startLat: 22.3193,
			startLng: 114.1694,
			endLat: 34.0522,
			endLng: -118.2437,
			arcAlt: 0.3,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 13,
			startLat: 52.52,
			startLng: 13.405,
			endLat: 22.3193,
			endLng: 114.1694,
			arcAlt: 0.3,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 13,
			startLat: 11.986597,
			startLng: 8.571831,
			endLat: 35.6762,
			endLng: 139.6503,
			arcAlt: 0.3,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 13,
			startLat: -22.9068,
			startLng: -43.1729,
			endLat: -34.6037,
			endLng: -58.3816,
			arcAlt: 0.1,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
		{
			order: 14,
			startLat: -33.936138,
			startLng: 18.436529,
			endLat: 21.395643,
			endLng: 39.883798,
			arcAlt: 0.3,
			color: colors[Math.floor(Math.random() * (colors.length - 1))],
		},
	]

	return (
		<div className="flex flex-row items-center justify-center py-10 h-screen md:h-auto dark:bg-black bg-white relative w-full">
			<div className="max-w-7xl mx-auto w-full flex flex-col items-center justify-between relative overflow-hidden h-full md:h-[56rem] px-4">
				<motion.div
					initial={{
						opacity: 0,
						y: 20,
					}}
					animate={{
						opacity: 1,
						y: 0,
					}}
					transition={{
						duration: 1,
					}}
					className="div flex flex-col items-center justify-center w-full h-full z-50 relative mt-20"
				>
					<h2 className="text-center text-5xl md:text-7xl font-thin text-black dark:text-white">
						COMTRACKER
					</h2>
					<p className="text-center text-xs md:text-base font-light text-neutral-700 dark:text-neutral-200 max-w-xl mt-2 mx-auto">
						TOOLS FOR IDENTIFYING INTERWALLET CONNECTIONS.
					</p>
					<Link
						href="/tracker"
						className="group mt-20 inline-flex h-12 animate-shimmer items-center justify-center rounded-md border border-slate-800 bg-[linear-gradient(110deg,#000103,45%,#1e2631,55%,#000103)] bg-[length:200%_100%] px-6 font-medium text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50 relative"
					>
						Launch App
						<span className="ml-1.5 transition-transform duration-200 ease-in-out transform group-hover:translate-x-1">
							&rarr;
						</span>
					</Link>
				</motion.div>
				<div className="w-full h-full flex items-center justify-center -bottom-50 md:-bottom-30">
					<div className="absolute w-full bottom-[0rem] inset-x-0 h-60 bg-gradient-to-b pointer-events-none select-none from-transparent dark:to-black to-white z-40" />
					<div className="absolute w-[60rem] h-[60rem] -bottom-[30rem] z-10">
						<World data={sampleArcs} globeConfig={globeConfig} />
					</div>
				</div>
			</div>
		</div>
	)
}
