import { useId } from "react";

import type { DogMood, DogAccessory } from "@/lib/pet-data";
export type { DogMood, DogAccessory } from "@/lib/pet-data";

export interface BrowniePetProps {
  mood?: DogMood;
  reacting?: boolean;
  accessory?: DogAccessory;
  className?: string;
}

export function BrowniePet({ mood = "happy", reacting = false, accessory = "basic-collar", className = "" }: BrowniePetProps) {
  const id = useId();
  const excited = mood === "excited" || mood === "celebrating";
  const sleepy = mood === "sleepy";

  return (
    <svg viewBox="0 0 260 240" className={`${reacting || excited ? "animate-dog-react" : ""} ${className}`} role="img" aria-label={`${mood} Brownie, a fluffy caramel poodoodle`}>
      <defs>
        <linearGradient id={`${id}-coat`} x1="74" y1="35" x2="183" y2="220" gradientUnits="userSpaceOnUse"><stop stopColor="#DCA36D" /><stop offset="1" stopColor="#B97543" /></linearGradient>
        <linearGradient id={`${id}-muzzle`} x1="105" y1="118" x2="155" y2="168" gradientUnits="userSpaceOnUse"><stop stopColor="#FFF0D5" /><stop offset="1" stopColor="#EAC79F" /></linearGradient>
        <filter id={`${id}-shadow`} x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#5F3A25" floodOpacity=".17" /></filter>
      </defs>

      {excited && <g className="animate-celebration" fill="#C9A96E"><path d="m31 54 3.5 8 8 3.5-8 3.5-3.5 8-3.5-8-8-3.5 8-3.5Z" /><path d="m229 68 2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5Z" /><circle cx="55" cy="33" r="4" fill="#A58A9F" /><circle cx="208" cy="39" r="4" fill="#6E2F3A" /></g>}

      <g filter={`url(#${id}-shadow)`}>
        <path d="M188 190c25-5 32-24 20-34-7-6-16-1-12 7 4 8-2 14-13 15Z" fill="#A9673E" />
        <g fill="#9B5D39"><circle cx="57" cy="75" r="20" /><circle cx="50" cy="96" r="23" /><circle cx="55" cy="119" r="21" /><circle cx="70" cy="133" r="18" /><circle cx="205" cy="75" r="20" /><circle cx="212" cy="96" r="23" /><circle cx="207" cy="119" r="21" /><circle cx="192" cy="133" r="18" /></g>
        <g fill="#B8764B" opacity=".72"><circle cx="55" cy="80" r="9" /><circle cx="49" cy="104" r="10" /><circle cx="64" cy="124" r="9" /><circle cx="207" cy="80" r="9" /><circle cx="213" cy="104" r="10" /><circle cx="198" cy="124" r="9" /></g>

        <ellipse cx="132" cy="194" rx="58" ry="34" fill={`url(#${id}-coat)`} />
        <g fill="#C78955"><circle cx="82" cy="184" r="18" /><circle cx="94" cy="172" r="19" /><circle cx="116" cy="169" r="18" /><circle cx="140" cy="169" r="18" /><circle cx="165" cy="174" r="20" /><circle cx="180" cy="190" r="18" /></g>
        <ellipse cx="91" cy="216" rx="25" ry="11" fill="#DDA36A" /><ellipse cx="173" cy="216" rx="25" ry="11" fill="#DDA36A" />

        <ellipse cx="131" cy="106" rx="66" ry="73" fill={`url(#${id}-coat)`} />
        <g fill="#D99B63"><circle cx="83" cy="58" r="18" /><circle cx="102" cy="42" r="19" /><circle cx="126" cy="35" r="20" /><circle cx="151" cy="39" r="20" /><circle cx="175" cy="53" r="19" /><circle cx="71" cy="79" r="17" /><circle cx="68" cy="105" r="18" /><circle cx="74" cy="130" r="18" /><circle cx="90" cy="149" r="17" /><circle cx="190" cy="74" r="18" /><circle cx="195" cy="99" r="18" /><circle cx="190" cy="126" r="18" /><circle cx="174" cy="148" r="17" /></g>
        <g fill="none" stroke="#AD6B42" strokeLinecap="round" strokeWidth="3" opacity=".38"><path d="M92 57c5-6 12-6 17 0M122 48c5-6 12-6 17 0M151 56c5-6 12-6 17 0" /><path d="M78 86c5-5 11-5 16 0M170 84c5-5 11-5 16 0" /></g>

        {sleepy ? <g fill="none" stroke="#3D2B23" strokeLinecap="round" strokeWidth="5"><path d="M91 106c6 5 13 5 19 0" /><path d="M152 106c6 5 13 5 19 0" /></g> : excited ? <g fill="none" stroke="#3D2B23" strokeLinecap="round" strokeWidth="5"><path d="m90 109 10-7 10 7" /><path d="m152 109 10-7 10 7" /></g> : <g fill="#3D2B23"><ellipse cx="101" cy="105" rx="7" ry={mood === "waiting" ? 8 : 7} /><ellipse cx="162" cy="105" rx="7" ry={mood === "waiting" ? 8 : 7} />{mood === "waiting" && <><circle cx="104" cy="102" r="2" fill="white" /><circle cx="165" cy="102" r="2" fill="white" /></>}</g>}

        <ellipse cx="131" cy="139" rx="42" ry="33" fill={`url(#${id}-muzzle)`} />
        <path d="M119 128c0-8 6-12 13-12s13 4 13 12c0 7-8 12-13 12s-13-5-13-12Z" fill="#4A3027" /><path d="M132 139v8" stroke="#654435" strokeLinecap="round" strokeWidth="3" />
        {excited ? <g><path d="M111 148c7 22 35 22 42 0Z" fill="#53352E" /><path d="M121 160c7-6 17-6 24 0-5 9-19 9-24 0Z" fill="#DE887E" /></g> : mood === "neutral" || mood === "waiting" ? <path d="M122 152h20" fill="none" stroke="#654435" strokeLinecap="round" strokeWidth="3" /> : sleepy ? <path d="M125 153c5-3 10-3 15 0" fill="none" stroke="#654435" strokeLinecap="round" strokeWidth="3" /> : <path d="M111 148c5 7 12 10 21 10s16-3 21-10" fill="none" stroke="#654435" strokeLinecap="round" strokeWidth="3" />}
        <ellipse cx="82" cy="136" rx="11" ry="7" fill="#DB897B" opacity=".32" /><ellipse cx="181" cy="136" rx="11" ry="7" fill="#DB897B" opacity=".32" />

        {(accessory === "basic-collar" || accessory === "lavender-collar") && <><path d="M91 176c22 11 58 11 81 0l-3 20c-25 10-51 10-75 0Z" fill={accessory === "lavender-collar" ? "#A58A9F" : "#6E2F3A"} /><circle cx="132" cy="193" r="8" fill="#C9A96E" /><path d="M129 191h6M132 188v6" stroke="#FFF8E9" strokeLinecap="round" strokeWidth="1.5" /></>}
        {accessory === "oxblood-bandana" && <path d="M91 175c25 12 56 12 81 0l-10 23-30-9-28 10Z" fill="#6E2F3A" />}
        {accessory === "bucket-hat" && <><path d="M86 57c7-29 23-41 46-41s39 12 46 41Z" fill="#6E2F3A" /><ellipse cx="132" cy="57" rx="59" ry="10" fill="#54232C" /></>}
        {accessory === "party-hat" && <><path d="m132 8 27 50h-54Z" fill="#A58A9F" /><circle cx="132" cy="8" r="7" fill="#C9A96E" /></>}
      </g>
    </svg>
  );
}
