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
        scene.background = new THREE.Color(COLORS.skyTop);
        scene.fog = new THREE.FogExp2(COLORS.skyTop, 0.012);
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        mountRef.current.appendChild(renderer.domElement);

        // --- LIGHTS ---
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
        scene.add(hemiLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(20, 30, 10);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        scene.add(dirLight);
        sunRef.current = dirLight;

        // --- WATER ---
        const waterGeo = new THREE.CylinderGeometry(WORLD_RADIUS + 80, WORLD_RADIUS + 80, 5, 64);
        const waterMat = new THREE.MeshStandardMaterial({
            color: 0x4dabf7,
            transparent: true,
            opacity: 0.8,
            roughness: 0.1,
            metalness: 0.5
        });
        const water = new THREE.Mesh(waterGeo, waterMat);
        water.position.y = -3.5;
        scene.add(water);
        waterRef.current = water;

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

            const skinMat = new THREE.MeshStandardMaterial({ color: 0xffe0bd, roughness: 0.5 });
            const clothesColor = type === 'michael' ? COLORS.michael : COLORS.douri;
            const clothMat = new THREE.MeshStandardMaterial({ color: clothesColor });
            const hairColor = type === 'michael' ? 0x2c3e50 : 0x8e44ad;
            const hairMat = new THREE.MeshStandardMaterial({ color: hairColor });

            const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 0.8, 16), clothMat);
            body.position.y = 0.6; body.castShadow = true; model.add(body);

            const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), skinMat);
            head.position.y = 1.25; head.castShadow = true; model.add(head);

            const eyeGeo = new THREE.SphereGeometry(0.05, 8, 8);
            const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
            const leftEye = new THREE.Mesh(eyeGeo, eyeMat); leftEye.position.set(-0.15, 1.25, 0.38); model.add(leftEye);
            const rightEye = new THREE.Mesh(eyeGeo, eyeMat); rightEye.position.set(0.15, 1.25, 0.38); model.add(rightEye);

            if (type === 'michael') {
                const hair = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), hairMat);
                hair.position.y = 1.25; hair.rotation.x = -0.2; model.add(hair);
            } else {
                const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 16, 0, Math.PI * 2, 0, Math.PI / 1.8), hairMat);
                hairTop.position.y = 1.25; model.add(hairTop);
                const pony = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.3, 0.8, 8), hairMat);
                pony.position.set(0, 0.9, -0.4); pony.rotation.x = 0.5; model.add(pony);
            }

            const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.5);
            const leftArmGroup = new THREE.Group(); leftArmGroup.position.set(-0.4, 0.9, 0);
            const leftArm = new THREE.Mesh(armGeo, clothMat); leftArm.position.y = -0.25; leftArmGroup.add(leftArm); model.add(leftArmGroup);

            const rightArmGroup = new THREE.Group(); rightArmGroup.position.set(0.4, 0.9, 0);
            const rightArm = new THREE.Mesh(armGeo, clothMat); rightArm.position.y = -0.25; rightArmGroup.add(rightArm); model.add(rightArmGroup);

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
            const island = new THREE.Mesh(new THREE.CylinderGeometry(WORLD_RADIUS, WORLD_RADIUS - 8, 5, 48), new THREE.MeshStandardMaterial({ color: COLORS.grass, flatShading: true }));
            island.position.y = -2.5; island.receiveShadow = true; worldGroup.add(island);

            // --- LAKE ---
            const lake = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 0.5, 32), new THREE.MeshStandardMaterial({ color: COLORS.water, roughness: 0.1, metalness: 0.2 }));
            lake.position.set(0, 0.05, -10); // Offset from castle
            worldGroup.add(lake);

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

            // --- BENCHES ---
            const benchMat = new THREE.MeshStandardMaterial({ color: 0x5D4037 });
            const benchCoords = [[10, 10], [-15, 15], [0, -28]];
            benchCoords.forEach(([bx, bz], idx) => {
                const bench = new THREE.Group();
                const seat = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 1.5), benchMat); seat.position.y = 1;
                const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1, 1.5), benchMat); lLeg.position.set(-1.5, 0.5, 0);
                const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1, 1.5), benchMat); rLeg.position.set(1.5, 0.5, 0);
                const back = new THREE.Mesh(new THREE.BoxGeometry(4, 1.5, 0.2), benchMat); back.position.set(0, 2, -0.6);
                bench.add(seat, lLeg, rLeg, back);
                bench.position.set(bx, 0, bz);
                // Face centerish
                bench.lookAt(0, 0, 0);
                bench.userData = { isBench: true, id: idx };
                worldGroup.add(bench);
            });

            // --- CASTLE ---
            const castleGroup = new THREE.Group();
            const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide });
            const roofMat = new THREE.MeshStandardMaterial({ color: 0xffaebc });

            const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ color: 0xf0f0f0 }));
            floor.rotation.x = -Math.PI / 2; floor.position.y = 0.05; castleGroup.add(floor);
            const backWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 8), wallMat);
            backWall.position.set(0, 4, -6); castleGroup.add(backWall);
            const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 8), wallMat);
            leftWall.position.set(-6, 4, 0); leftWall.rotation.y = Math.PI / 2; castleGroup.add(leftWall);
            const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 8), wallMat);
            rightWall.position.set(6, 4, 0); rightWall.rotation.y = -Math.PI / 2; castleGroup.add(rightWall);
            const frontLeft = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 8), wallMat);
            frontLeft.position.set(-3.75, 4, 6); frontLeft.rotation.y = Math.PI; castleGroup.add(frontLeft);
            const frontRight = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 8), wallMat);
            frontRight.position.set(3.75, 4, 6); frontRight.rotation.y = Math.PI; castleGroup.add(frontRight);
            const frontTop = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), wallMat);
            frontTop.position.set(0, 6.5, 6); frontTop.rotation.y = Math.PI; castleGroup.add(frontTop);
            const mainRoof = new THREE.Mesh(new THREE.ConeGeometry(10, 5, 4), roofMat);
            mainRoof.position.y = 10.5; mainRoof.rotation.y = Math.PI / 4; castleGroup.add(mainRoof);
            const towerGeo = new THREE.CylinderGeometry(1.5, 1.5, 10);
            const roofGeo = new THREE.ConeGeometry(2, 3, 4);
            [[-6, -6], [6, -6], [-6, 6], [6, 6]].forEach(([tx, tz]) => {
                const tower = new THREE.Mesh(towerGeo, wallMat);
                tower.position.set(tx, 5, tz); tower.castShadow = true; castleGroup.add(tower);
                const roof = new THREE.Mesh(roofGeo, roofMat);
                roof.position.set(tx, 11.5, tz); roof.rotation.y = Math.PI / 4; castleGroup.add(roof);
            });

            // STOVE
            const stove = new THREE.Group();
            const stoveBody = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial({ color: 0x333333 }));
            stoveBody.position.y = 1; stove.add(stoveBody);
            const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
            burner.position.set(-0.5, 2.05, 0.5); stove.add(burner);
            const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.2), new THREE.MeshStandardMaterial({ color: 0x555555 }));
            pan.position.set(-0.5, 2.15, 0.5); stove.add(pan);
            stove.position.set(-4, 0, -4); stove.userData = { isStove: true };
            castleGroup.add(stove);

            castleGroup.position.set(0, 0, 35); castleGroup.scale.setScalar(1.5); worldGroup.add(castleGroup);

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
        const animate = () => {
            animationId = requestAnimationFrame(animate);
            const rawDelta = clock.getDelta();
            const delta = Math.min(rawDelta, 0.1);
            const time = clock.getElapsedTime();

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
            if (sunRef.current) {
                const dayDuration = 60;
                const dayTime = (time % dayDuration) / dayDuration;
                const angle = dayTime * Math.PI * 2;

                sunRef.current.position.set(Math.cos(angle) * 30, Math.sin(angle) * 30, 20);
                sunRef.current.intensity = Math.max(0.1, Math.sin(angle)) * 1.5;

                // Sky Color
                const dayColor = new THREE.Color(COLORS.skyTop);
                const nightColor = new THREE.Color(0x110033);
                const mixRatio = 0.5 + 0.5 * Math.sin(angle);
                const curSky = dayColor.clone().lerp(nightColor, 1 - mixRatio);
                scene.background = curSky;
                scene.fog.color = curSky;
            }
            if (waterRef.current) {
                waterRef.current.rotation.y += delta * 0.02;
                waterRef.current.position.y = -3.5 + Math.sin(time * 0.5) * 0.2;
            }

            renderer.render(scene, camera);
        };

        animate();

        return () => {
            cancelAnimationFrame(animationId);
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