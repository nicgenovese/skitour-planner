/**
 * PDF tour plan generator using jsPDF
 */

import { jsPDF } from 'jspdf';
import type { RouteData, WeatherDay } from '@/types';
import type { RegionBulletin } from './avalanche-parser';

interface TourPlanData {
  route: RouteData;
  date: string;
  participants: string[];
  weather?: WeatherDay[];
  bulletin?: RegionBulletin;
}

export function generateTourPDF(plan: TourPlanData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margin = 15;
  let y = margin;
  const pageWidth = 210 - 2 * margin;

  // ── Title ──
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Skitour Plan', margin, y);
  y += 10;

  doc.setFontSize(16);
  doc.text(plan.route.name, margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${plan.date}`, margin, y);
  y += 5;
  doc.text(`Participants: ${plan.participants.join(', ') || 'N/A'}`, margin, y);
  y += 8;

  // ── Route Info ──
  drawSectionHeader(doc, 'Route Overview', margin, y);
  y += 7;

  const routeInfo = [
    ['Difficulty', plan.route.difficulty],
    ['Total Elevation', `${plan.route.totalElevation}m`],
    ['Distance', `${plan.route.distance} km`],
    ['Estimated Time', plan.route.estimatedTime],
  ];

  doc.setFontSize(9);
  for (const [label, value] of routeInfo) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}: `, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, margin + 35, y);
    y += 4.5;
  }
  y += 2;

  if (plan.route.keyInfo) {
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(plan.route.keyInfo, pageWidth);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 4;
  }

  // ── Waypoints ──
  drawSectionHeader(doc, 'Waypoints', margin, y);
  y += 7;

  doc.setFontSize(8);
  for (let i = 0; i < plan.route.waypoints.length; i++) {
    const wp = plan.route.waypoints[i];
    doc.setFont('helvetica', 'bold');
    doc.text(`${i + 1}. ${wp.label}`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `${wp.elevation ? wp.elevation + 'm' : ''} (${wp.lat.toFixed(4)}, ${wp.lon.toFixed(4)})`,
      margin + 50,
      y
    );
    y += 4.5;
    if (y > 270) { doc.addPage(); y = margin; }
  }
  y += 4;

  // ── Danger Zones ──
  if (plan.route.dangerZones.length > 0) {
    drawSectionHeader(doc, 'Danger Zones', margin, y);
    y += 7;

    doc.setFontSize(8);
    for (const dz of plan.route.dangerZones) {
      doc.setFont('helvetica', 'bold');
      doc.text(`Level ${dz.level} — ${dz.aspect}, ${dz.altitude}`, margin, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(dz.description, pageWidth);
      doc.text(lines, margin, y);
      y += lines.length * 3.5 + 3;
      if (y > 270) { doc.addPage(); y = margin; }
    }
    y += 2;
  }

  // ── Avalanche Bulletin ──
  if (plan.bulletin) {
    drawSectionHeader(doc, 'Avalanche Bulletin Summary', margin, y);
    y += 7;

    doc.setFontSize(8);
    for (const dr of plan.bulletin.dangerRatings) {
      doc.text(
        `Danger Level ${dr.level} (${dr.levelLabel}) — ${dr.elevationBand || 'all'}, aspects: ${dr.aspects.join(', ')}`,
        margin, y
      );
      y += 4;
    }
    if (plan.bulletin.problems.length > 0) {
      y += 2;
      doc.text('Problems:', margin, y);
      y += 4;
      for (const p of plan.bulletin.problems) {
        doc.text(`- ${p.type.replace(/_/g, ' ')} (${p.aspects.join(', ')})`, margin + 3, y);
        y += 3.5;
      }
    }
    y += 4;
    if (y > 270) { doc.addPage(); y = margin; }
  }

  // ── Weather ──
  if (plan.weather && plan.weather.length > 0) {
    drawSectionHeader(doc, 'Weather Forecast', margin, y);
    y += 7;

    doc.setFontSize(8);
    for (const day of plan.weather.slice(0, 3)) {
      doc.text(
        `${day.date}: ${day.tempMin}°/${day.tempMax}°C, snow ${day.snowfall}cm, wind ${day.windSpeedMax}km/h`,
        margin, y
      );
      y += 4;
    }
    y += 4;
  }

  // ── Equipment Checklist ──
  drawSectionHeader(doc, 'Equipment Checklist', margin, y);
  y += 7;

  doc.setFontSize(8);
  const equipment = [
    'LVS / Avalanche beacon (tested!)',
    'Shovel + Probe',
    'First aid kit',
    'Phone (charged) + emergency numbers',
    'Skins + ski crampons',
    'Map + compass / GPS',
    'Food + water + thermos',
    'Sun protection + goggles',
    'Extra layer + emergency bivy',
  ];

  if (plan.route.keyInfo?.toLowerCase().includes('glacier')) {
    equipment.push('Harness + rope + crampons + ice axe');
  }

  for (const item of equipment) {
    doc.rect(margin, y - 2.5, 3, 3);
    doc.text(item, margin + 5, y);
    y += 4.5;
    if (y > 270) { doc.addPage(); y = margin; }
  }
  y += 4;

  // ── Emergency Contacts ──
  drawSectionHeader(doc, 'Emergency Contacts', margin, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('REGA Rescue: 1414', margin, y);
  y += 5;
  doc.text('SLF Info: +41 81 417 01 11', margin, y);
  y += 5;
  doc.text('Police: 117 | Ambulance: 144', margin, y);

  // ── Footer ──
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Generated by Skitour Planer — ${new Date().toLocaleDateString('de-CH')}`,
    margin,
    290
  );

  return doc;
}

function drawSectionHeader(doc: jsPDF, title: string, x: number, y: number) {
  doc.setFillColor(30, 58, 95);
  doc.rect(x, y - 3, 180, 6, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(title, x + 2, y + 1);
  doc.setTextColor(0, 0, 0);
}

export function downloadTourPDF(plan: TourPlanData) {
  const doc = generateTourPDF(plan);
  doc.save(`${plan.route.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_plan.pdf`);
}
