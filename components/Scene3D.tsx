import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { JoystickData, CharacterType, PlayerData } from '../types';
import { COLORS, WORLD_RADIUS, MEMORIES } from '../constants';

interface Scene3DProps {
    input: JoystickData;
    isJumping: boolean;
    onResetJump: () => void;
    myCharType: CharacterType;
    players: Record<string, PlayerData>;
    onUpdatePosition: (x: number, y: number, z: number, rot: number, moving: boolean) => void;
    onNearMemory: (id: number | null) => void;
    myEmote: { name: string, time: number } | null;
    onNearStove?: (isNear: boolean) => void;
    onNearTreehouse?: (isNear: boolean) => void;
    teleportRequest?: { x: number, y: number, z: number, id: number };
    burgerCount: number; // Added to trigger effects
    onNearBench?: (isNear: boolean, benchId: number | null) => void;
    isSitting?: boolean;
    isSprinting?: boolean;
}

const Scene3D: React.FC<Scene3DProps> = ({
    input,
    isJumping,
    onResetJump,
    myCharType,
    players,
    onUpdatePosition,
    onNearMemory,
    myEmote,
    onNearStove,
    onNearTreehouse,
    teleportRequest,
    burgerCount,
    onNearBench,
    isSitting,
    isSprinting
}) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const myMeshRef = useRef<THREE.Group | null>(null);
    const playersMeshesRef = useRef<Record<string, THREE.Group>>({});
    const particlesRef = useRef<THREE.Group>(new THREE.Group());
    const waterRef = useRef<THREE.Mesh | null>(null);
    const sunRef = useRef<THREE.DirectionalLight | null>(null);

    // Game state refs
    const inputRef = useRef(input);
    const playersDataRef = useRef(players);
    const myEmoteRef = useRef(myEmote);
    const prevBurgerCount = useRef(burgerCount);
    const isSittingRef = useRef(isSitting);
    const isSprintingRef = useRef(isSprinting);
    const callbacksRef = useRef({ onUpdatePosition, onNearMemory, onNearStove, onNearTreehouse, onResetJump, onNearBench });

    const lastTeleportId = useRef(0);

    // Camera state refs
    const camDistRef = useRef(20); // Zoom level
    const camAngleHRef = useRef(0);
    const camAngleVRef = useRef(0.6);
    const isDraggingRef = useRef(false);
    const prevPointerRef = useRef({ x: 0, y: 0 });

    // Pinch Zoom Refs
    const touchDistRef = useRef<number | null>(null);
    const heartsRef = useRef<{ mesh: THREE.Mesh; speed: number }[]>([]);
    const heartAssetsRef = useRef<{ geo: THREE.ShapeGeometry; mat: THREE.MeshBasicMaterial } | null>(null);

    // Sync refs
    useEffect(() => { inputRef.current = input; }, [input]);
    useEffect(() => { playersDataRef.current = players; }, [players]);
    useEffect(() => { myEmoteRef.current = myEmote; }, [myEmote]);
    useEffect(() => { myEmoteRef.current = myEmote; }, [myEmote]);
    useEffect(() => { isSittingRef.current = isSitting; }, [isSitting]);
    useEffect(() => { isSprintingRef.current = isSprinting; }, [isSprinting]);
    useEffect(() => {
        callbacksRef.current = { onUpdatePosition, onNearMemory, onNearStove, onNearTreehouse, onResetJump, onNearBench };
    }, [onUpdatePosition, onNearMemory, onNearStove, onNearTreehouse, onResetJump, onNearBench]);

    // Burger Cooking Effect
    useEffect(() => {
        if (burgerCount > prevBurgerCount.current) {
            // Trigger smoke effect at stove location
            // Kitchen is at global (-6, 2, 29) approx
            for (let i = 0; i < 10; i++) {
                const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
                sprite.position.set(-6 + (Math.random() - 0.5), 3, 29 + (Math.random() - 0.5));
                sprite.scale.setScalar(0.5);
                sprite.userData = {
                    velocity: new THREE.Vector3((Math.random() - 0.5) * 0.1, 0.1 + Math.random() * 0.1, (Math.random() - 0.5) * 0.1),
                    life: 1.0
                };
                particlesRef.current.add(sprite);
            }
        }
        prevBurgerCount.current = burgerCount;
    }, [burgerCount]);

    // Independent Jump Effect
    useEffect(() => {
        if (isJumping && myMeshRef.current && !myMeshRef.current.userData.isJumping && !isSitting) {
            myMeshRef.current.userData.isJumping = true;
            myMeshRef.current.userData.velocityY = 8;
        }
    }, [isJumping, isSitting]);

    // Independent Teleport Effect
    useEffect(() => {
        if (teleportRequest && teleportRequest.id !== lastTeleportId.current && myMeshRef.current) {
            myMeshRef.current.position.set(teleportRequest.x, teleportRequest.y, teleportRequest.z);
            myMeshRef.current.userData.velocityY = 0;
            myMeshRef.current.userData.isJumping = false;
            lastTeleportId.current = teleportRequest.id;
        }
    }, [teleportRequest]);

    // --- INPUT HANDLERS ---
    const handleWheel = (e: React.WheelEvent) => {
        e.stopPropagation();
        camDistRef.current += e.deltaY * 0.02;
        camDistRef.current = Math.max(8, Math.min(60, camDistRef.current));
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        // Left click (0) or Middle click (1) or Touch
        if (e.button !== 0 && e.button !== 1 && e.pointerType === 'mouse') return;

        (e.target as Element).setPointerCapture(e.pointerId);
        isDraggingRef.current = true;
        prevPointerRef.current = { x: e.clientX, y: e.clientY };
        touchDistRef.current = null; // Reset pinch
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDraggingRef.current) return;

        const deltaX = e.clientX - prevPointerRef.current.x;
        const deltaY = e.clientY - prevPointerRef.current.y;
        prevPointerRef.current = { x: e.clientX, y: e.clientY };

        camAngleHRef.current -= deltaX * 0.005;
        camAngleVRef.current += deltaY * 0.005;
        camAngleVRef.current = Math.max(0.1, Math.min(Math.PI / 2.1, camAngleVRef.current));
    };

    // Pinch Zoom Logic (basic implementation)
    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (touchDistRef.current !== null) {
                const delta = touchDistRef.current - dist;
                camDistRef.current += delta * 0.1;
                camDistRef.current = Math.max(8, Math.min(60, camDistRef.current));
            }
            touchDistRef.current = dist;
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        isDraggingRef.current = false;
        touchDistRef.current = null;
        (e.target as Element).releasePointerCapture(e.pointerId);
    };

    useEffect(() => {
        if (!mountRef.current) return;

        // --- SETUP ---
        const width = window.innerWidth;
        const height = window.innerHeight;

        const scene = new THREE.Scene();
        // SOFTER SKY GRADIENT - Pastel colors
        const skyColor = new THREE.Color(0x87CEEB); // Softer sky blue
        scene.background = skyColor;
        scene.fog = new THREE.FogExp2(skyColor, 0.008); // Less dense fog
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping; // Minecraft-like color grading
        renderer.toneMappingExposure = 1.2; // Brighter, more vibrant
        mountRef.current.appendChild(renderer.domElement);

        // --- WARMER LIGHTING ---
        const hemiLight = new THREE.HemisphereLight(0xffffeb, 0xffd4b3, 0.8); // Warm sky & ground
        scene.add(hemiLight);
        const dirLight = new THREE.DirectionalLight(0xfff5e6, 1.0); // Warm sunlight
        dirLight.position.set(20, 30, 10);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.far = 100;
        dirLight.shadow.bias = -0.0001;
        scene.add(dirLight);
        sunRef.current = dirLight;

        // --- GOD RAYS (Volumetric Light) ---
        const godRaysGroup = new THREE.Group();
        const rayGeo = new THREE.ConeGeometry(5, 40, 32, 1, true);
        const rayMat = new THREE.MeshBasicMaterial({
            color: 0xffffee,
            transparent: true,
            opacity: 0.15,
            side: THREE.FrontSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });

        for (let i = 0; i < 5; i++) {
            const ray = new THREE.Mesh(rayGeo, rayMat);
            ray.position.set(0, 0, 0);
            ray.scale.set(1 + Math.random(), 1 + Math.random(), 1 + Math.random());
            ray.rotation.x = Math.PI; // Point down
            ray.rotation.z = (Math.random() - 0.5) * 0.5;
            ray.rotation.y = Math.random() * Math.PI;
            ray.userData = { speed: 0.02 + Math.random() * 0.02, phase: Math.random() * Math.PI };
            godRaysGroup.add(ray);
        }
        godRaysGroup.position.set(20, 30, 10); // Match sun position roughly
        godRaysGroup.lookAt(0, 0, 0);
        scene.add(godRaysGroup);

        // --- SHADER-QUALITY WATER ---
        const waterGeo = new THREE.CylinderGeometry(WORLD_RADIUS + 80, WORLD_RADIUS + 80, 5, 64);
        const waterMat = new THREE.MeshStandardMaterial({
            color: 0x4dabf7,
            transparent: true,
            opacity: 0.85,
            roughness: 0.05,  // Very smooth for reflections
            metalness: 0.9,   // High metalness for realistic water
            envMapIntensity: 2.0  // Enhanced reflections
        });
        const water = new THREE.Mesh(waterGeo, waterMat);
        water.position.y = -3.5;
        scene.add(water);
        waterRef.current = water;

        // --- BUTTERFLIES & FIREFLIES ---
        const butterflyGroup = new THREE.Group();
        const fireflyGroup = new THREE.Group();

        // Create butterflies
        for (let i = 0; i < 8; i++) {
            const wing1Geo = new THREE.CircleGeometry(0.15, 8);
            const wing2Geo = new THREE.CircleGeometry(0.15, 8);
            const butterflyMat = new THREE.MeshBasicMaterial({
                color: Math.random() > 0.5 ? 0xffb3f5 : 0xb3f5ff,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.8
            });

            const wing1 = new THREE.Mesh(wing1Geo, butterflyMat);
            const wing2 = new THREE.Mesh(wing2Geo, butterflyMat);
            wing1.position.x = -0.1;
            wing2.position.x = 0.1;

            const butterfly = new THREE.Group();
            butterfly.add(wing1, wing2);
            butterfly.position.set(
                (Math.random() - 0.5) * WORLD_RADIUS,
                Math.random() * 5 + 2,
                (Math.random() - 0.5) * WORLD_RADIUS
            );
            butterfly.userData = {
                speed: 0.5 + Math.random() * 0.5,
                angle: Math.random() * Math.PI * 2,
                height: butterfly.position.y,
                wingTime: Math.random() * Math.PI
            };
            butterflyGroup.add(butterfly);
        }
        scene.add(butterflyGroup);

        // Create fireflies (show at night)
        for (let i = 0; i < 20; i++) {
            const fireflyGeo = new THREE.SphereGeometry(0.1, 8, 8);
            const fireflyMat = new THREE.MeshBasicMaterial({
                color: 0xffff88,
                transparent: true,
                opacity: 0
            });
            const firefly = new THREE.Mesh(fireflyGeo, fireflyMat);
            firefly.position.set(
                (Math.random() - 0.5) * WORLD_RADIUS * 0.8,
                Math.random() * 5 + 1,
                (Math.random() - 0.5) * WORLD_RADIUS * 0.8
            );
            firefly.userData = {
                speed: 0.3 + Math.random() * 0.3,
                angle: Math.random() * Math.PI * 2,
                glowTime: Math.random() * Math.PI * 2
            };
            fireflyGroup.add(firefly);
        }
        scene.add(fireflyGroup);

        // --- CLOUDS ---
        const cloudGroup = new THREE.Group();
        for (let i = 0; i < 10; i++) {
            const cloud = new THREE.Group();
            const cloudMat = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.6
            });

            // Make clouds from multiple spheres
            for (let j = 0; j < 5; j++) {
                const puff = new THREE.Mesh(
                    new THREE.SphereGeometry(2 + Math.random() * 2, 8, 8),
                    cloudMat
                );
                puff.position.set(
                    (Math.random() - 0.5) * 6,
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 4
                );
                cloud.add(puff);
            }

            cloud.position.set(
                (Math.random() - 0.5) * WORLD_RADIUS * 2,
                20 + Math.random() * 10,
                (Math.random() - 0.5) * WORLD_RADIUS * 2
            );
            cloud.userData = { speed: 0.5 + Math.random() * 0.5 };
            cloudGroup.add(cloud);
        }
        scene.add(cloudGroup);

        // --- ASSETS ---
        const textureLoader = new THREE.TextureLoader();
        const worldGroup = new THREE.Group();
        const playersGroup = new THREE.Group();
        const animalsGroup = new THREE.Group();
        const skyGroup = new THREE.Group();
        scene.add(worldGroup, playersGroup, animalsGroup, skyGroup);
        scene.add(particlesRef.current);

        // Helper: Create Chibi
        const createChibi = (type: CharacterType) => {
            const group = new THREE.Group();
            const model = new THREE.Group();
            group.add(model);

            // CUTER COLORS - Warmer skin tone and softer clothes
            const skinMat = new THREE.MeshStandardMaterial({ color: 0xffd4b3, roughness: 0.6 });
            const clothesColor = type === 'michael' ? 0x6fb3ff : 0xffb3d9; // Softer pastel colors
            const clothMat = new THREE.MeshStandardMaterial({ color: clothesColor, roughness: 0.4 });
            const hairColor = type === 'michael' ? 0x4a5f7a : 0xb88fc7; // Softer hair colors
            const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.3 });

            // SMALLER, ROUNDER BODY
            const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.8), clothMat);
            body.position.y = 0.5;
            body.scale.y = 0.8; // Squash it a bit
            body.castShadow = true;
            model.add(body);

            // MUCH BIGGER HEAD (chibi proportions!)
            const head = new THREE.Mesh(new THREE.SphereGeometry(0.7, 32, 32), skinMat);
            head.position.y = 1.3;
            head.castShadow = true;
            model.add(head);

            // CUTE BIG ANIME EYES
            const eyeWhiteGeo = new THREE.SphereGeometry(0.12, 16, 16);
            const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const leftEyeWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
            leftEyeWhite.position.set(-0.22, 1.35, 0.55);
            leftEyeWhite.scale.y = 1.3; // Taller eyes
            model.add(leftEyeWhite);

            const rightEyeWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
            rightEyeWhite.position.set(0.22, 1.35, 0.55);
            rightEyeWhite.scale.y = 1.3;
            model.add(rightEyeWhite);

            // Black pupils
            const pupilGeo = new THREE.SphereGeometry(0.08, 12, 12);
            const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
            const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
            leftPupil.position.set(-0.22, 1.35, 0.62);
            model.add(leftPupil);

            const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
            rightPupil.position.set(0.22, 1.35, 0.62);
            model.add(rightPupil);

            // SHINY EYE HIGHLIGHTS (sparkle!)
            const highlightGeo = new THREE.SphereGeometry(0.03, 8, 8);
            const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const leftHighlight = new THREE.Mesh(highlightGeo, highlightMat);
            leftHighlight.position.set(-0.19, 1.42, 0.66);
            model.add(leftHighlight);

            const rightHighlight = new THREE.Mesh(highlightGeo, highlightMat);
            rightHighlight.position.set(0.25, 1.42, 0.66);
            model.add(rightHighlight);

            // CUTE BLUSH MARKS
            const blushGeo = new THREE.SphereGeometry(0.08, 12, 12);
            const blushMat = new THREE.MeshBasicMaterial({ color: 0xffb3c1, transparent: true, opacity: 0.6 });
            const leftBlush = new THREE.Mesh(blushGeo, blushMat);
            leftBlush.position.set(-0.45, 1.15, 0.45);
            leftBlush.scale.set(1, 0.6, 0.5);
            model.add(leftBlush);

            const rightBlush = new THREE.Mesh(blushGeo, blushMat);
            rightBlush.position.set(0.45, 1.15, 0.45);
            rightBlush.scale.set(1, 0.6, 0.5);
            model.add(rightBlush);

            // CUTER HAIR
            if (type === 'michael') {
                const hair = new THREE.Mesh(new THREE.SphereGeometry(0.68, 20, 20, 0, Math.PI * 2, 0, Math.PI / 2), hairMat);
                hair.position.y = 1.4;
                hair.rotation.x = -0.15;
                model.add(hair);

                // Add cute hair tuft
                const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), hairMat);
                tuft.position.set(0.1, 1.85, 0.2);
                model.add(tuft);
            } else {
                const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.68, 20, 20, 0, Math.PI * 2, 0, Math.PI / 1.6), hairMat);
                hairTop.position.y = 1.4;
                model.add(hairTop);

                // Cuter ponytail
                const pony = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), hairMat);
                pony.position.set(0, 1.1, -0.6);
                pony.scale.set(0.8, 1.5, 0.8);
                model.add(pony);
            }

            // SMALLER, ROUNDER ARMS
            const armGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.4);
            const leftArmGroup = new THREE.Group();
            leftArmGroup.position.set(-0.42, 0.8, 0);
            const leftArm = new THREE.Mesh(armGeo, clothMat);
            leftArm.position.y = -0.2;
            leftArmGroup.add(leftArm);
            model.add(leftArmGroup);

            const rightArmGroup = new THREE.Group();
            rightArmGroup.position.set(0.42, 0.8, 0);
            const rightArm = new THREE.Mesh(armGeo, clothMat);
            rightArm.position.y = -0.2;
            rightArmGroup.add(rightArm);
            model.add(rightArmGroup);

            // TINY CUTE HANDS
            const handGeo = new THREE.SphereGeometry(0.08, 10, 10);
            const leftHand = new THREE.Mesh(handGeo, skinMat);
            leftHand.position.y = -0.4;
            leftArmGroup.add(leftHand);

            const rightHand = new THREE.Mesh(handGeo, skinMat);
            rightHand.position.y = -0.4;
            rightArmGroup.add(rightHand);

            const legGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.5);
            const pantsMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
            const leftLegGroup = new THREE.Group(); leftLegGroup.position.set(-0.2, 0.5, 0);
            const leftLeg = new THREE.Mesh(legGeo, pantsMat); leftLeg.position.y = -0.25; leftLegGroup.add(leftLeg); model.add(leftLegGroup);

            const rightLegGroup = new THREE.Group(); rightLegGroup.position.set(0.2, 0.5, 0);
            const rightLeg = new THREE.Mesh(legGeo, pantsMat); rightLeg.position.y = -0.25; rightLegGroup.add(rightLeg); model.add(rightLegGroup);

            group.userData = {
                model, leftArm: leftArmGroup, rightArm: rightArmGroup, leftLeg: leftLegGroup, rightLeg: rightLegGroup, head, type,
                walkTime: 0, velocityY: 0, isJumping: false, emoteTimer: 0, currentEmote: null
            };
            return group;
        };

        // Helper: Build World
        const buildWorld = () => {
            // Island Base
            const island = new THREE.Mesh(new THREE.CylinderGeometry(WORLD_RADIUS, WORLD_RADIUS - 8, 5, 48), new THREE.MeshStandardMaterial({ color: COLORS.sand, flatShading: true }));
            island.position.y = -2.5; island.receiveShadow = true; worldGroup.add(island);

            // --- HILLS ---
            const hillGeo = new THREE.SphereGeometry(15, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.5);
            const hillMat = new THREE.MeshStandardMaterial({ color: 0x7bc043, flatShading: true });

            const hill1 = new THREE.Mesh(hillGeo, hillMat);
            hill1.position.set(-30, -5, -30); hill1.scale.y = 1.5; worldGroup.add(hill1);

            const hill2 = new THREE.Mesh(hillGeo, hillMat);
            hill2.position.set(30, -5, -40); hill2.scale.set(1.5, 1.2, 1.5); worldGroup.add(hill2);

            // --- MOUNTAIN ---
            const mtnGeo = new THREE.ConeGeometry(20, 30, 5);
            const mtnMat = new THREE.MeshStandardMaterial({ color: 0x888888, flatShading: true });
            const mtnTopMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true });
            const mtn = new THREE.Group();
            const mtnBody = new THREE.Mesh(mtnGeo, mtnMat); mtn.add(mtnBody);
            const mtnTop = new THREE.Mesh(new THREE.ConeGeometry(8, 12, 5), mtnTopMat);
            mtnTop.position.y = 9; mtn.add(mtnTop);
            mtn.position.set(-50, 0, 10);
            worldGroup.add(mtn);

            // --- REALISTIC PALM TREES (3D Geometry) ---
            const createPalmTree = (x: number, z: number, scale = 1) => {
                const tree = new THREE.Group();
                tree.position.set(x, 0, z);

                // --- TRUNK ---
                const trunkMat = new THREE.MeshStandardMaterial({
                    color: 0x8B5A2B, // Richer brown
                    roughness: 0.9,
                    flatShading: true
                });

                // Base
                const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * scale, 0.6 * scale, 1.5 * scale, 7), trunkMat);
                base.position.y = 0.75 * scale;
                base.castShadow = true;
                tree.add(base);

                // Curved segments
                let currentY = 1.5 * scale;
                let currentX = 0;
                const curveAngle = (Math.random() - 0.5) * 0.2; // Random slight lean

                for (let i = 0; i < 4; i++) {
                    const h = 1.2 * scale;
                    const topR = 0.45 * scale * (1 - i * 0.08);
                    const botR = 0.5 * scale * (1 - i * 0.08);

                    const seg = new THREE.Mesh(new THREE.CylinderGeometry(topR, botR, h, 7), trunkMat);
                    seg.position.set(currentX, currentY + h / 2, 0);
                    seg.rotation.z = i * curveAngle;
                    seg.castShadow = true;
                    tree.add(seg);

                    currentY += h * Math.cos(i * curveAngle);
                    currentX -= h * Math.sin(i * curveAngle);
                }

                // --- FRONDS (3D Arches) ---
                const frondMat = new THREE.MeshStandardMaterial({
                    color: 0x2E8B57, // SeaGreen
                    roughness: 0.8,
                    flatShading: true,
                    side: THREE.DoubleSide
                });

                const createFrond = (yRot: number) => {
                    const frondGroup = new THREE.Group();
                    frondGroup.rotation.y = yRot;
                    frondGroup.position.set(currentX, currentY - 0.2 * scale, 0); // Attach to top

                    // Make frond out of 5 segments to form an arch
                    for (let j = 0; j < 5; j++) {
                        const len = 1.0 * scale;
                        const width = (0.6 - j * 0.1) * scale;
                        const thick = 0.05 * scale;

                        const part = new THREE.Mesh(new THREE.BoxGeometry(width, thick, len), frondMat);

                        // Initial position relative to start of frond
                        const zPos = j * len * 0.9;
                        const yPos = Math.sin(j * 0.5) * 0.5 * scale; // Arch up

                        part.position.set(0, yPos, zPos + len / 2);
                        part.rotation.x = j * 0.3; // Curve down
                        part.castShadow = true;
                        frondGroup.add(part);
                    }
                    return frondGroup;
                };

                // Add 7 fronds around
                for (let k = 0; k < 7; k++) {
                    tree.add(createFrond(k * (Math.PI * 2 / 7)));
                }

                // Coconuts!
                const cocoMat = new THREE.MeshStandardMaterial({ color: 0x4B3621 });
                for (let c = 0; c < 3; c++) {
                    const coco = new THREE.Mesh(new THREE.SphereGeometry(0.25 * scale, 6, 6), cocoMat);
                    const angle = c * (Math.PI * 2 / 3);
                    coco.position.set(
                        currentX + Math.cos(angle) * 0.4 * scale,
                        currentY - 0.2 * scale,
                        Math.sin(angle) * 0.4 * scale
                    );
                    tree.add(coco);
                }

                return tree;
            };

            // Place palm trees around island
            const palmPositions = [
                [-20, -15], [-25, -10], [-18, -20],
                [20, -15], [25, -10], [18, -20],
                [-15, 15], [-20, 20], [-12, 18],
                [15, 15], [20, 20], [12, 18],
                [0, -25], [-8, -28], [8, -28],
                [28, 5], [-28, 5], [5, 28], [-5, 28]
            ];

            palmPositions.forEach(([x, z]) => {
                const scale = 0.9 + Math.random() * 0.3;
                worldGroup.add(createPalmTree(x, z, scale));
            });

            // --- PICNIC BLANKET (For Two) 🧺 ---
            const blanket = new THREE.Mesh(
                new THREE.PlaneGeometry(3, 3),
                new THREE.MeshStandardMaterial({ color: 0xffaebc, side: THREE.DoubleSide }) // Pinkish blanket
            );
            blanket.rotation.x = -Math.PI / 2;
            blanket.position.set(5, 0.05, 5); // Near center but not 0,0
            blanket.receiveShadow = true;
            blanket.userData = { isBlanket: true }; // Clickable
            worldGroup.add(blanket);

            // Picnic Basket
            const basket = new THREE.Group();
            const basketBody = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: 0x8B4513 }));
            basketBody.position.y = 0.25;
            basket.add(basketBody);
            basket.position.set(6, 0, 6);
            worldGroup.add(basket);

            // --- MEMORY BOARDS (Keep for your special memories!) ---
            MEMORIES.forEach(mem => {
                const board = new THREE.Group();
                const pole = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.1, 0.1, 3),
                    new THREE.MeshStandardMaterial({ color: 0x8B4513 })
                );
                pole.position.y = 1.5;
                pole.castShadow = true;
                board.add(pole);

                const sign = new THREE.Mesh(
                    new THREE.BoxGeometry(2, 1.5, 0.2),
                    new THREE.MeshStandardMaterial({ color: 0xffb7b2 })
                );
                sign.position.y = 3.2;
                sign.castShadow = true;
                board.add(sign);

                board.position.set(mem.x, 0, mem.z);
                board.userData = { isMemory: true, memoryId: mem.id };
                worldGroup.add(board);
            });

            // --- STOVE (Keep for burger game!) ---
            const stove = new THREE.Group();
            const stoveBody = new THREE.Mesh(
                new THREE.BoxGeometry(2, 2, 2),
                new THREE.MeshStandardMaterial({ color: 0x333333 })
            );
            stoveBody.position.y = 1;
            stoveBody.castShadow = true;
            stove.add(stoveBody);

            const burner = new THREE.Mesh(
                new THREE.CylinderGeometry(0.3, 0.3, 0.1),
                new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5 })
            );
            burner.position.set(-0.5, 2.05, 0.5);
            stove.add(burner);

            const pan = new THREE.Mesh(
                new THREE.CylinderGeometry(0.4, 0.3, 0.2),
                new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.8 })
            );
            pan.position.set(-0.5, 2.15, 0.5);
            pan.castShadow = true;
            stove.add(pan);

            stove.position.set(-8, 0, 28);
            stove.userData = { isStove: true };
            worldGroup.add(stove);

            // --- PLANE ---
            const planeGroup = new THREE.Group();
            const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 8, 8), new THREE.MeshStandardMaterial({ color: 0xeeeeee }));
            fuselage.rotation.z = Math.PI / 2; planeGroup.add(fuselage);
            const wings = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 10), new THREE.MeshStandardMaterial({ color: 0x4dabf7 }));
            wings.position.set(0, 0, 0); planeGroup.add(wings);
            const pTail = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.2), new THREE.MeshStandardMaterial({ color: 0xff8787 }));
            pTail.position.set(-3.5, 1, 0); planeGroup.add(pTail);
            const prop = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 0.2), new THREE.MeshStandardMaterial({ color: 0x333333 }));
            prop.position.set(4, 0, 0); prop.userData = { isProp: true }; planeGroup.add(prop);
            planeGroup.position.set(-40, 2, -30); planeGroup.rotation.y = Math.PI / 4; planeGroup.scale.setScalar(1.5); worldGroup.add(planeGroup);

            // --- TREE HOUSE ---
            const treeHouseGroup = new THREE.Group();
            const thTrunk = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.5, 10, 8), new THREE.MeshStandardMaterial({ color: 0x8B4513 }));
            thTrunk.position.y = 5; treeHouseGroup.add(thTrunk);
            const thPlatform = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0xDEB887 }));
            thPlatform.position.y = 9.5; treeHouseGroup.add(thPlatform);
            const thHouse = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5), new THREE.MeshStandardMaterial({ color: 0xA0522D }));
            thHouse.position.y = 12.25; treeHouseGroup.add(thHouse);
            const thRoof = new THREE.Mesh(new THREE.ConeGeometry(4.5, 3, 4), new THREE.MeshStandardMaterial({ color: 0x228b22 }));
            thRoof.position.y = 16.25; thRoof.rotation.y = Math.PI / 4; treeHouseGroup.add(thRoof);
            treeHouseGroup.position.set(40, 0, 20); treeHouseGroup.scale.setScalar(1.2); worldGroup.add(treeHouseGroup);


            // Sky & Stars
            const starsGeo = new THREE.BufferGeometry();
            const starCount = 1000;
            const posArray = new Float32Array(starCount * 3);
            for (let i = 0; i < starCount * 3; i++) posArray[i] = (Math.random() - 0.5) * 400;
            starsGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
            const starsMat = new THREE.PointsMaterial({ size: 0.4, color: 0xffffff, transparent: true, opacity: 0.8 });
            const starMesh = new THREE.Points(starsGeo, starsMat);
            skyGroup.add(starMesh); skyGroup.userData = { starMesh };

            // Mini Planets
            const planetColors = [0xff6b6b, 0x4dabf7, 0xfeeaa7];
            for (let i = 0; i < 3; i++) {
                const planet = new THREE.Mesh(new THREE.SphereGeometry(2 + i, 16, 16), new THREE.MeshStandardMaterial({ color: planetColors[i], flatShading: true }));
                const orbitR = 80 + i * 20; const angle = (Math.PI * 2 / 3) * i;
                planet.position.set(Math.cos(angle) * orbitR, 40 + i * 5, Math.sin(angle) * orbitR);
                planet.userData = { orbitR, angle, speed: 0.05 + i * 0.02 };
                skyGroup.add(planet);
            }

            // Shooting Star
            const shootingStar = new THREE.Mesh(new THREE.ConeGeometry(0.2, 4, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
            shootingStar.rotation.z = Math.PI / 2; shootingStar.userData = { active: false }; skyGroup.add(shootingStar); skyGroup.userData.shootingStar = shootingStar;

            // Flowers
            const flowerGeo = new THREE.CylinderGeometry(0, 0.1, 0.2, 5);
            const stemMat = new THREE.MeshBasicMaterial({ color: 0x228b22 });
            for (let i = 0; i < 300; i++) {
                const x = (Math.random() - 0.5) * 150; const z = (Math.random() - 0.5) * 150;
                // Avoid lake area (radius 15 at 0, -10)
                const distLake = Math.sqrt(x * x + (z - (-10)) ** 2);
                if (Math.sqrt(x * x + z * z) < WORLD_RADIUS - 1.5 && Math.sqrt(x * x + z * z) > 5 && distLake > 16) {
                    const plant = new THREE.Group(); plant.scale.setScalar(0.5 + Math.random() * 0.5);
                    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3), stemMat); stem.position.y = 0.15; plant.add(stem);
                    const cols = [0xff69b4, 0xffa500, 0xffffff, 0xdda0dd, 0xffff00];
                    const petals = new THREE.Mesh(flowerGeo, new THREE.MeshBasicMaterial({ color: cols[Math.floor(Math.random() * cols.length)] }));
                    petals.position.y = 0.3; plant.add(petals);
                    plant.position.set(x, 0, z); plant.rotation.y = Math.random() * Math.PI; plant.rotation.z = (Math.random() - 0.5) * 0.2;
                    worldGroup.add(plant);
                }
            }

            // Memories
            MEMORIES.forEach(mem => {
                const marker = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 16), new THREE.MeshBasicMaterial({ color: 0xffff00 }));
                marker.position.set(mem.x, 0.5, mem.z); marker.userData = { baseY: 0.5, id: mem.id, isFinal: mem.isFinal }; worldGroup.add(marker);
                if (mem.image) {
                    const frameGroup = new THREE.Group(); frameGroup.position.set(mem.x, 2.5, mem.z);
                    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.6, 0.1), new THREE.MeshStandardMaterial({ color: 0xffffff })); frameGroup.add(frame);
                    const photoMat = new THREE.MeshBasicMaterial({ color: 0xeeeeee, side: THREE.DoubleSide });
                    textureLoader.load(mem.image, (tex) => { photoMat.map = tex; photoMat.color.setHex(0xffffff); photoMat.needsUpdate = true; });
                    const photo = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), photoMat); photo.position.z = 0.06; photo.position.y = 0.1; frameGroup.add(photo);
                    frameGroup.userData = { isPhoto: true, baseY: 2.5, phase: Math.random() * Math.PI }; worldGroup.add(frameGroup);
                }
                if (mem.isFinal) {
                    const finalZone = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.1, 32), new THREE.MeshBasicMaterial({ color: 0xff6b6b, transparent: true, opacity: 0.5 }));
                    finalZone.position.set(mem.x, 0.05, mem.z); worldGroup.add(finalZone);
                }
            });

            // Trees
            for (let i = 0; i < 60; i++) {
                const x = (Math.random() - 0.5) * (WORLD_RADIUS * 1.8); const z = (Math.random() - 0.5) * (WORLD_RADIUS * 1.8);
                const distLake = Math.sqrt(x * x + (z - (-10)) ** 2);
                if (Math.sqrt(x * x + z * z) > WORLD_RADIUS - 2) continue; if (Math.sqrt(x * x + z * z) < 5) continue; if (distLake < 16) continue;
                const treeGroup = new THREE.Group(); treeGroup.position.set(x, 0, z); treeGroup.scale.setScalar(0.8 + Math.random() * 0.5);
                const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 2, 6), new THREE.MeshStandardMaterial({ color: 0x8B4513 }));
                trunk.position.y = 1; trunk.castShadow = true; treeGroup.add(trunk);
                const leaves = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffaebc, flatShading: true }));
                leaves.position.y = 2.5; leaves.castShadow = true; treeGroup.add(leaves);
                treeGroup.userData = { isTree: true, phase: Math.random() * Math.PI }; worldGroup.add(treeGroup);
            }

            // ANIMALS
            const animalMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
            for (let i = 0; i < 5; i++) {
                const sheep = new THREE.Group();
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 1), animalMat); body.position.y = 0.5; sheep.add(body);
                const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.5), new THREE.MeshStandardMaterial({ color: 0x333333 })); head.position.set(0, 0.8, 0.6); sheep.add(head);
                [[-0.3, -0.4], [0.3, -0.4], [-0.3, 0.4], [0.3, 0.4]].forEach(([lx, lz]) => {
                    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5), new THREE.MeshStandardMaterial({ color: 0x111111 }));
                    leg.position.set(lx, 0.25, lz); sheep.add(leg);
                });
                sheep.position.set((Math.random() - 0.5) * 40, 0, (Math.random() - 0.5) * 40);
                sheep.userData = { isAnimal: true, velocity: new THREE.Vector3(), nextMove: 0 };
                animalsGroup.add(sheep);
            }

            // Dog (Tango)
            const dog = new THREE.Group();
            const dogMat = new THREE.MeshStandardMaterial({ color: 0xeebb44 });
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.8), dogMat); body.position.y = 0.3; dog.add(body);
            const dHead = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.4), dogMat); dHead.position.set(0, 0.6, 0.5); dog.add(dHead);
            const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.4), dogMat); tail.position.set(0, 0.4, -0.5); tail.rotation.x = 0.5; dog.add(tail);

            const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = "rgba(0,0,0,0)"; ctx.fillRect(0, 0, 256, 64);
                ctx.fillStyle = "#ffffff"; ctx.font = "bold 32px Quicksand"; ctx.textAlign = "center";
                ctx.textBaseline = "middle"; ctx.shadowColor = "black"; ctx.shadowBlur = 4;
                ctx.fillText("Tango ❤️", 128, 32);
            }
            const tex = new THREE.CanvasTexture(canvas);
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
            sprite.position.set(0, 1.2, 0); sprite.scale.set(2, 0.5, 1); dog.add(sprite);

            dog.userData = { type: 'dog', tail: tail }; dog.position.set(3, 0, 3);
            animalsGroup.add(dog);
        };

        buildWorld();

        // --- MY PLAYER ---
        const myMesh = createChibi(myCharType);
        myMesh.position.set(Math.random() * 4 - 2, 0, 15);
        playersGroup.add(myMesh);
        myMeshRef.current = myMesh;

        // Set initial camera position behind player
        camera.position.set(myMesh.position.x, myMesh.position.y + 10, myMesh.position.z + 20);
        camera.lookAt(myMesh.position.x, myMesh.position.y + 1, myMesh.position.z);

        // --- ANIMATION VARIABLES ---
        const clock = new THREE.Clock();
        let lastUpdate = 0;
        let animationId: number;

        // --- HELPER: ANIMATE CHARACTER ---
        const animateCharacter = (mesh: THREE.Group, speed: number, time: number, emoteName: string | undefined, emoteTime: number, isSittingState: boolean = false) => {
            const data = mesh.userData;
            const isGrounded = mesh.position.y <= 0.1;

            // Reset parts
            data.head.rotation.set(0, 0, 0);
            data.model.rotation.set(0, 0, 0);
            data.leftArm.rotation.set(0, 0, 0);
            data.rightArm.rotation.set(0, 0, 0);
            data.leftLeg.rotation.set(0, 0, 0);
            data.rightLeg.rotation.set(0, 0, 0);

            if (isSittingState) {
                data.model.position.y = 0.3; // Sit height
                data.leftLeg.rotation.x = -Math.PI / 2;
                data.rightLeg.rotation.x = -Math.PI / 2;
                data.head.rotation.y = Math.sin(time * 0.5) * 0.1;
                return; // Skip other animations
            }

            // Check if emote is active (lasts 3 seconds)
            const isEmoting = emoteName && (Date.now() - emoteTime < 3000);

            if (isEmoting && isGrounded) {
                if (emoteName === 'dance') {
                    data.model.rotation.y = Math.sin(time * 10) * 0.5;
                    data.model.position.y = Math.abs(Math.sin(time * 15)) * 0.3;
                    data.leftArm.rotation.z = Math.sin(time * 10) * 2;
                    data.rightArm.rotation.z = -Math.sin(time * 10) * 2;
                } else if (emoteName === 'wave') {
                    data.rightArm.rotation.z = 2.5;
                    data.rightArm.rotation.x = Math.sin(time * 15) * 0.5;
                    data.head.rotation.y = 0.2;
                } else if (emoteName === 'heart') {
                    data.leftArm.rotation.z = 2.5;
                    data.rightArm.rotation.z = -2.5;
                    data.model.position.y = Math.abs(Math.sin(time * 2)) * 0.1;
                }
            } else if (speed > 0 && isGrounded) {
                data.walkTime += 0.2;
                data.leftLeg.rotation.x = Math.sin(data.walkTime) * 0.5; data.rightLeg.rotation.x = Math.sin(data.walkTime + Math.PI) * 0.5;
                data.leftArm.rotation.x = Math.sin(data.walkTime + Math.PI) * 0.5; data.rightArm.rotation.x = Math.sin(data.walkTime) * 0.5;
                data.model.position.y = Math.abs(Math.sin(data.walkTime * 2)) * 0.1;
            } else {
                data.leftLeg.rotation.x = THREE.MathUtils.lerp(data.leftLeg.rotation.x, 0, 0.1);
                data.rightLeg.rotation.x = THREE.MathUtils.lerp(data.rightLeg.rotation.x, 0, 0.1);
                data.leftArm.rotation.x = THREE.MathUtils.lerp(data.leftArm.rotation.x, 0, 0.1);
                data.rightArm.rotation.x = THREE.MathUtils.lerp(data.rightArm.rotation.x, 0, 0.1);
                if (isGrounded) data.model.position.y = THREE.MathUtils.lerp(data.model.position.y, 0, 0.1);
                data.head.rotation.y = Math.sin(time * 0.5) * 0.1;
            }
        };

        // --- LOOP ---
        // Create Heart Assets once
        if (!heartAssetsRef.current) {
            const heartShape = new THREE.Shape();
            heartShape.moveTo(0.25, 0.25);
            heartShape.bezierCurveTo(0.25, 0.25, 0.20, 0, 0, 0);
            heartShape.bezierCurveTo(-0.30, 0, -0.30, 0.35, -0.30, 0.35);
            heartShape.bezierCurveTo(-0.30, 0.55, -0.10, 0.77, 0.25, 0.95);
            heartShape.bezierCurveTo(0.60, 0.77, 0.80, 0.55, 0.80, 0.35);
            heartShape.bezierCurveTo(0.80, 0.35, 0.80, 0, 0.50, 0);
            heartShape.bezierCurveTo(0.35, 0, 0.25, 0.25, 0.25, 0.25);
            heartAssetsRef.current = {
                geo: new THREE.ShapeGeometry(heartShape),
                mat: new THREE.MeshBasicMaterial({ color: 0xff69b4, side: THREE.DoubleSide })
            };
        }
        const { geo: heartGeo, mat: heartMat } = heartAssetsRef.current;

        // Function to spawn a heart
        const spawnHeart = (x: number, y: number, z: number) => {
            if (heartsRef.current.length > 20) return; // Limit limit
            const heart = new THREE.Mesh(heartGeo, heartMat);
            const scale = 0.2 + Math.random() * 0.2;
            heart.scale.set(scale, -scale, scale); // Flip Y because shape is drawn upside down-ish
            heart.rotation.z = Math.PI; // Flip right side up
            heart.position.set(x, y, z);
            sceneRef.current?.add(heart);
            heartsRef.current.push({ mesh: heart, speed: 0.05 + Math.random() * 0.05 });
        };

        const animate = () => {
            animationId = requestAnimationFrame(animate);
            const rawDelta = clock.getDelta();
            const delta = Math.min(rawDelta, 0.1);
            const time = clock.getElapsedTime();

            // Animate Hearts
            for (let i = heartsRef.current.length - 1; i >= 0; i--) {
                const h = heartsRef.current[i];
                h.mesh.position.y += h.speed;
                //h.mesh.material.opacity = Math.max(0, 1 - (h.mesh.position.y - 2) / 3); 
                if (h.mesh.position.y > 6 + h.mesh.position.y) { // Simple cull
                    sceneRef.current?.remove(h.mesh);
                    heartsRef.current.splice(i, 1);
                } else if (h.mesh.position.y > 10) {
                    sceneRef.current?.remove(h.mesh);
                    heartsRef.current.splice(i, 1);
                }
            }

            // Proximity Check
            if (myMeshRef.current && Object.keys(playersDataRef.current).length > 0) {
                Object.values(playersDataRef.current).forEach((p: any) => {
                    if (playersMeshesRef.current[p.id]) {
                        const dist = myMeshRef.current!.position.distanceTo(playersMeshesRef.current[p.id].position);
                        if (dist < 3) {
                            // Spawn hearts randomly
                            if (Math.random() < 0.02) {
                                spawnHeart(
                                    myMeshRef.current!.position.x + (Math.random() - 0.5),
                                    myMeshRef.current!.position.y + 2,
                                    myMeshRef.current!.position.z + (Math.random() - 0.5)
                                );
                            }
                        }
                    }
                });
            }

            const inputs = inputRef.current;
            const otherPlayers = playersDataRef.current;
            const myMesh = myMeshRef.current;
            const myEmoteData = myEmoteRef.current;
            const callbacks = callbacksRef.current;
            const sitting = isSittingRef.current;

            if (myMesh) {
                let speed = 0;
                const moveSpeed = 6 * delta;

                // Jumping
                if (myMesh.userData.isJumping) {
                    const gravity = -15;
                    myMesh.userData.velocityY += gravity * delta;
                    myMesh.position.y += myMesh.userData.velocityY * delta;
                    if (myMesh.position.y <= 0) {
                        myMesh.position.y = 0;
                        myMesh.userData.isJumping = false;
                        myMesh.userData.velocityY = 0;
                        callbacks.onResetJump();
                    }
                }

                if ((inputs.x !== 0 || inputs.y !== 0) && !sitting) {
                    speed = isSprintingRef.current ? 1.8 : 1;
                    const actualMoveSpeed = moveSpeed * speed;
                    const inputAngle = Math.atan2(-inputs.x, inputs.y);

                    const targetRotation = camAngleHRef.current + inputAngle + Math.PI;
                    let rotDiff = targetRotation - myMesh.rotation.y;
                    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2; while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
                    myMesh.rotation.y += rotDiff * 0.15;
                    myMesh.position.x += Math.sin(myMesh.rotation.y) * actualMoveSpeed;
                    myMesh.position.z += Math.cos(myMesh.rotation.y) * actualMoveSpeed;
                }

                // Boundary
                const dist = Math.sqrt(myMesh.position.x ** 2 + myMesh.position.z ** 2);
                if (dist > WORLD_RADIUS - 1) {
                    const angle = Math.atan2(myMesh.position.z, myMesh.position.x);
                    myMesh.position.x = Math.cos(angle) * (WORLD_RADIUS - 1); myMesh.position.z = Math.sin(angle) * (WORLD_RADIUS - 1);
                }

                animateCharacter(myMesh, speed, time, myEmoteData?.name, myEmoteData?.time || 0, sitting);

                // Camera Follow
                const camDist = camDistRef.current;
                const camAngleH = camAngleHRef.current;
                const camAngleV = camAngleVRef.current;
                const offsetX = camDist * Math.sin(camAngleH) * Math.cos(camAngleV);
                const offsetY = camDist * Math.sin(camAngleV);
                const offsetZ = camDist * Math.cos(camAngleH) * Math.cos(camAngleV);
                const targetCamPos = new THREE.Vector3(myMesh.position.x + offsetX, myMesh.position.y + offsetY, myMesh.position.z + offsetZ);

                camera.position.lerp(targetCamPos, 0.2);
                camera.lookAt(myMesh.position.x, myMesh.position.y + 1, myMesh.position.z);

                // Triggers
                let nearMemoryId: number | null = null;
                MEMORIES.forEach(mem => {
                    const d = Math.sqrt((myMesh.position.x - mem.x) ** 2 + (myMesh.position.z - mem.z) ** 2);
                    if (d < 3) nearMemoryId = mem.id;
                });
                callbacks.onNearMemory(nearMemoryId);

                const distToKitchen = Math.sqrt((myMesh.position.x - (-6)) ** 2 + (myMesh.position.z - 29) ** 2);
                if (callbacks.onNearStove) callbacks.onNearStove(distToKitchen < 4);

                const distToTreehouse = Math.sqrt((myMesh.position.x - 40) ** 2 + (myMesh.position.z - 20) ** 2);
                if (callbacks.onNearTreehouse) callbacks.onNearTreehouse(distToTreehouse < 5);

                // Bench Trigger
                let nearBenchId: number | null = null;
                worldGroup.children.forEach(obj => {
                    if (obj.userData.isBench) {
                        const d = myMesh.position.distanceTo(obj.position);
                        if (d < 3) nearBenchId = obj.userData.id;
                    }
                });
                if (callbacks.onNearBench) callbacks.onNearBench(nearBenchId !== null, nearBenchId);

                if (Date.now() - lastUpdate > 100) {
                    callbacks.onUpdatePosition(myMesh.position.x, myMesh.position.y, myMesh.position.z, myMesh.rotation.y, speed > 0);
                    lastUpdate = Date.now();
                }

            }

            // Sync Other Players
            Object.keys(otherPlayers).forEach(pid => {
                const pData = otherPlayers[pid];
                let mesh = playersMeshesRef.current[pid];

                if (!mesh) {
                    mesh = createChibi(pData.type);
                    playersGroup.add(mesh);
                    playersMeshesRef.current[pid] = mesh;
                }

                mesh.position.lerp(new THREE.Vector3(pData.x, pData.y, pData.z), 0.1);
                let dRot = pData.rot - mesh.rotation.y;
                while (dRot > Math.PI) dRot -= Math.PI * 2; while (dRot < -Math.PI) dRot += Math.PI * 2;
                mesh.rotation.y += dRot * 0.1;

                const speed = pData.moving ? 1 : 0;
                animateCharacter(mesh, speed, time, pData.emote?.name, pData.emote?.time || 0);
            });

            // Cleanup
            Object.keys(playersMeshesRef.current).forEach(pid => {
                if (!otherPlayers[pid]) {
                    playersGroup.remove(playersMeshesRef.current[pid]);
                    delete playersMeshesRef.current[pid];
                }
            });

            // --- ANIMATE DOG (TANGO) ---
            animalsGroup.children.forEach(animal => {
                if (animal.userData.type === 'dog') {
                    // Tail wag
                    if (animal.userData.tail) animal.userData.tail.rotation.y = Math.sin(time * 10) * 0.5;

                    // Find Douri
                    let target: THREE.Vector3 | null = null;

                    // Am I douri?
                    if (myCharType === 'douri' && myMesh) target = myMesh.position;

                    // Or check other players
                    if (!target) {
                        const pIds = Object.keys(otherPlayers);
                        for (let pid of pIds) {
                            if (otherPlayers[pid].type === 'douri') {
                                target = new THREE.Vector3(otherPlayers[pid].x, otherPlayers[pid].y, otherPlayers[pid].z);
                                break;
                            }
                        }
                    }

                    if (target) {
                        const dist = animal.position.distanceTo(target);
                        if (dist > 3) {
                            animal.lookAt(target.x, animal.position.y, target.z);
                            animal.translateZ(delta * 4);
                        }
                    }
                }
                else if (animal.userData.isAnimal) {
                    // Generic animal wandering
                    if (time > animal.userData.nextMove) {
                        animal.userData.nextMove = time + 2 + Math.random() * 3;
                        animal.rotation.y = Math.random() * Math.PI * 2;
                        animal.userData.velocity.set(0, 0, 1 + Math.random()).applyAxisAngle(new THREE.Vector3(0, 1, 0), animal.rotation.y);
                    }
                    animal.position.addScaledVector(animal.userData.velocity, delta);

                    // Limits
                    if (animal.position.length() > WORLD_RADIUS - 5) {
                        animal.position.setLength(WORLD_RADIUS - 5);
                        animal.userData.nextMove = 0; // Turn around sooner
                    }
                }
            });

            // Particles
            particlesRef.current.children.forEach(p => {
                const particle = p as THREE.Sprite;
                particle.position.addScaledVector(particle.userData.velocity, delta);
                particle.material.opacity -= delta * 0.5;
                if (particle.material.opacity <= 0) {
                    particle.position.y = -100; // recycle hack
                }
            });

            // Sky
            if (skyGroup.userData.starMesh) skyGroup.userData.starMesh.rotation.y += delta * 0.02;
            skyGroup.children.forEach(child => {
                if (child.userData.orbitR) {
                    child.userData.angle += child.userData.speed * delta;
                    child.position.x = Math.cos(child.userData.angle) * child.userData.orbitR;
                    child.position.z = Math.sin(child.userData.angle) * child.userData.orbitR;
                }
            });
            worldGroup.children.forEach(group => {
                group.children.forEach(mesh => {
                    if (mesh.userData.isProp) mesh.rotation.x += delta * 15;
                });
            });

            // Day/Night & Water
            // Day/Night Cycle & Atmosphere
            if (sunRef.current) {
                const dayDuration = 120; // Slower day (2 min)
                const dayTime = (time % dayDuration) / dayDuration;
                const angle = dayTime * Math.PI * 2;
                const sunHeight = Math.sin(angle);

                // Sun movement
                sunRef.current.position.set(Math.cos(angle) * 40, sunHeight * 40, 20);
                sunRef.current.intensity = Math.max(0, sunHeight) * 1.5;

                // God Rays follow sun
                godRaysGroup.position.copy(sunRef.current.position);
                godRaysGroup.lookAt(0, 0, 0);
                godRaysGroup.children.forEach(ray => {
                    ray.rotation.y += delta * ray.userData.speed;
                    const pulse = 0.1 + Math.sin(time + ray.userData.phase) * 0.05;
                    (ray.material as THREE.MeshBasicMaterial).opacity = Math.max(0, sunHeight) * pulse;
                });

                // Dynamic Sky Colors
                let topColor, fogColor;
                if (sunHeight > 0.2) { // Day
                    topColor = new THREE.Color(0x87CEEB); // Sky Blue
                    fogColor = new THREE.Color(0x87CEEB);
                } else if (sunHeight > -0.1) { // Sunset/Sunrise
                    topColor = new THREE.Color(0xff9966); // Orange
                    fogColor = new THREE.Color(0xff7755); // Reddish Orange
                } else { // Night
                    topColor = new THREE.Color(0x0f0c29); // Deep Purple
                    fogColor = new THREE.Color(0x1a1a2e); // Dark Blue
                }

                // Smooth Lerp
                scene.background = (scene.background as THREE.Color).lerp(topColor, delta * 0.5);
                scene.fog.color = (scene.fog.color as THREE.Color).lerp(fogColor, delta * 0.5);

                // Stars & Fireflies (Visible at Night)
                const isNight = sunHeight < 0.1;
                skyGroup.userData.starMesh.material.opacity = THREE.MathUtils.lerp(skyGroup.userData.starMesh.material.opacity, isNight ? 0.8 : 0, delta);

                fireflyGroup.children.forEach(ff => {
                    const f = ff as THREE.Mesh;
                    f.position.y += Math.sin(time * 2 + f.userData.glowTime) * 0.01;
                    f.position.x += Math.cos(time * 0.5 + f.userData.glowTime) * 0.01;
                    (f.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.lerp((f.material as THREE.MeshBasicMaterial).opacity, isNight ? 0.8 + Math.sin(time * 5 + f.userData.glowTime) * 0.2 : 0, delta);
                });
            }

            // Water Waves
            if (waterRef.current) {
                waterRef.current.rotation.y += delta * 0.01;
                waterRef.current.position.y = -3.5 + Math.sin(time * 0.8) * 0.15;
                (waterRef.current.material as THREE.MeshStandardMaterial).opacity = 0.8 + Math.sin(time * 0.5) * 0.05;
            }

            renderer.render(scene, camera);
        };

        const handleResize = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            renderer.setSize(w, h);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        };
        window.addEventListener('resize', handleResize);

        animate();

        return () => {
            cancelAnimationFrame(animationId);
            window.removeEventListener('resize', handleResize);
            if (mountRef.current) {
                mountRef.current.removeChild(renderer.domElement);
            }
            renderer.dispose();
        };

    }, []);

    return (
        <div
            ref={mountRef}
            className="absolute inset-0 outline-none"
            style={{ touchAction: 'none' }}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onLostPointerCapture={handlePointerUp}
            onTouchMove={handleTouchMove}
        />
    );
};

export default Scene3D;