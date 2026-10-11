/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Buddy Roams engine — a faithful, self-contained port of the VS Code "Buddy"
 * chat pet (src/vs/workbench/contrib/chat/browser/widget/chatPetWidget.ts)
 * adapted to run in the editor area overlay. Keyboard control and the
 * achievement system are intentionally omitted.
 */
(function () {
	'use strict';

	var CONFIG = window.__BETTER_PET_CONFIG__ || {};
	var SPRITES = CONFIG.sprites || {};
	var ACCESSORY_ATLASES = CONFIG.accessories || {};
	var ROOT = window.__BETTER_PET_ROOT__;
	if (!ROOT || !document) { return; }

	/* ========================================================================== */
	/* Constants                                                                  */
	/* ========================================================================== */

	var TRANSIENT_STATE_DURATION = 2000;
	var COMPLETE_STATE_DURATION = 960;
	var BUTTON_PRESS_STATE_DURATION = 2850;
	var SPLAT_STATE_DURATION = 520;
	var LOVE_STATE_DURATION = 2940;
	var COOL_STATE_DURATION = 3000;
	var SING_STATE_DURATION = 2880;
	var SPEECHLESS_STATE_DURATION = 2720;
	var WORRY_STATE_DURATION = 2400;
	var DIZZY_STATE_DURATION = 2200;
	var WAKE_STATE_DURATION = 880;

	var IDLE_SLEEP_DELAY = 20000;
	var ICON_TRANSFORMATION_CHANCE = 1 / 100;
	var YAPPING_CHANCE = 1 / 100;
	var WALL_IMPACT_DURATION = 48;
	var MOUSE_BOUNCE_RELEASE_GRACE_DURATION = 500;
	var BOUNCE_RESULT_DURATION = 5000;
	var CONFETTI_SCORE = 20;

	var DIZZY_DIRECTION_CHANGE_COUNT = 8;
	var DIZZY_DIRECTION_CHANGE_MAX_INTERVAL = 600;
	var DRAG_THRESHOLD = 2;

	var BLINK_MIN_DELAY = 1400;
	var BLINK_MAX_DELAY = 3400;
	var POSITION_EPSILON = 0.5;
	var THROW_VELOCITY_SAMPLE_DURATION = 100;
	var POINTER_VELOCITY_SAMPLE_LIMIT = 8;
	var THROW_RELEASE_GRACE_DURATION = 80;
	var THROW_MIN_VELOCITY = 650;
	var THROW_MAX_VELOCITY = 2400;
	var THROW_GRAVITY = 1800;
	var CURSOR_CLEAR_DISTANCE = 140; // px; the pet keeps this distance from the caret
	var HOP_DISTANCE = 24; // px traveled per hop (matches the built-in pet)
	var HOP_APEX_DELAY = 300; // ms: the horizontal shift happens at the jump apex
	var HOP_REST_DELAY = 40; // ms: rest between chained hops
	var HOP_HOLD_GRACE = 350; // ms: keep hopping while requests keep arriving
	var HOP_IDLE_DEBOUNCE = 900; // ms: clear the jump state after the last request
	var HOP_AVOID_INTERVAL = 100; // ms between avoidance decisions
	var THROW_MAX_FRAME_DURATION = 32;
	var THROW_MAX_DURATION = 4000;
	var THROW_WALL_RESTITUTION = 0.2;
	var THROW_CEILING_RESTITUTION = 0.2;
	var THROW_ROTATION_PER_PIXEL = 0.65;
	var THROW_SELF_RIGHTING_START_VELOCITY = -450;
	var THROW_SELF_RIGHTING_SPEED = 720;
	var MOUSE_BOUNCE_MIN_UPWARD_VELOCITY = 760;
	var MOUSE_BOUNCE_MAX_UPWARD_VELOCITY = 1800;
	var MOUSE_BOUNCE_VERTICAL_RESTITUTION = 0.65;
	var MOUSE_BOUNCE_UPWARD_TRANSFER = 0.4;
	var MOUSE_BOUNCE_HORIZONTAL_RETENTION = 0.65;
	var MOUSE_BOUNCE_HORIZONTAL_TRANSFER = 0.35;
	var MOUSE_BOUNCE_EDGE_KICK = 320;
	var MOUSE_BOUNCE_MAX_HORIZONTAL_VELOCITY = 1800;

	var CHAT_PET_DISPLAY_SIZE = 48;
	var CHAT_PET_SOURCE_SIZE = 96;
	var CHAT_PET_SLEEP_SOURCE_WIDTH = 120;
	var CHAT_PET_TYPING_SOURCE_WIDTH = 168;
	var CHAT_PET_BUTTON_PRESS_SOURCE_WIDTH = 160;
	var CHAT_PET_SING_SOURCE_WIDTH = 164;
	var CHAT_PET_SING_SOURCE_HEIGHT = 124;
	var CHAT_PET_DIZZY_SOURCE_HEIGHT = 128;
	var CHAT_PET_DEFAULT_RIGHT_INSET = 32;
	var CHAT_PET_MIN_SCALE = 0.4;
	var CHAT_PET_SCALE_STEP = 0.2;
	var CHAT_PET_DEFAULT_SCALE = 1;
	var CHAT_PET_SPEECH_BUBBLE_RIGHT_OVERHANG = 20;

	var IDLE_FRAME_DURATIONS = repeat(50, 40);
	var SLEEP_FRAME_DURATIONS = repeat(8, 300);
	var WAKE_FRAME_DURATIONS = [160, 100, 80, 90, 90, 90, 100, 170];
	var TYPING_FRAME_DURATIONS = [320, 480];
	var BUTTON_PRESS_FRAME_DURATIONS = [500, 300, 350, 250, 450, 1000];
	var FALLING_FRAME_DURATIONS = [120, 80, 80, 120, 80, 80];
	var JUMP_FRAME_DURATIONS = [70, 80, 90, 160, 100, 100];
	var SPLAT_FRAME_DURATIONS = [120, 100, 100, 200];
	var RESPAWN_FRAME_DURATIONS = [120, 100, 120, 240, 100, 120];
	var SPEECH_FRAME_DURATIONS = [220, 220, 220, 100, 160, 180];
	var CLAPPING_FRAME_DURATIONS = [80, 40, 40, 40, 80, 40, 40, 40, 40, 80, 40, 40, 80];
	var LOVE_FRAME_DURATIONS = [200, 200, 380, 100, 80, 1980];
	var COOL_FRAME_DURATIONS = [600, 120, 120, 120, 160, 80, 80, 80, 1640];
	var SING_FRAME_DURATIONS = [180, 180, 180, 180];
	var SPEECHLESS_FRAME_DURATIONS = [400, 120, 1000, 120, 1080];
	var WORRY_FRAME_DURATIONS = [600, 600];
	var DIZZY_FRAME_DURATIONS = repeat(8, 120);
	var SEARCH_FRAME_DURATIONS = [500, 500, 500, 500];

	var SING_FIXED_ORIENTATION_DECORATIONS = [
		{ frameBounds: [[16, 36, 80, 52], [16, 36, 80, 52], [16, 36, 80, 52], [16, 36, 80, 52]], sourceFrame: 0 },
		{ frameBounds: [[96, 8, 160, 72], [96, 4, 160, 68], [100, 0, 164, 64], [92, 4, 156, 68]], sourceFrame: 0 },
	];

	/* ========================================================================== */
	/* Small helpers                                                              */
	/* ========================================================================== */

	function repeat(count, value) {
		var result = new Array(count);
		for (var i = 0; i < count; i++) { result[i] = value; }
		return result;
	}

	function clamp(value, minimum, maximum) {
		return Math.max(minimum, Math.min(maximum, value));
	}

	function now() {
		return (typeof performance !== 'undefined' ? performance : Date).now();
	}

	/* ========================================================================== */
	/* State names                                                                */
	/* ========================================================================== */

	var CLICK_INTERACTIONS = ['buttonPress', 'love', 'cool', 'sing', 'speechless', 'worry'];

	function doesChatPetStateTrackCursor(state) {
		if (state === undefined) { return false; }
		return state !== 'sleep' && state !== 'waking' && state !== 'typing' && state !== 'buttonPress'
			&& state !== 'complete' && state !== 'jump' && state !== 'love' && state !== 'cool'
			&& state !== 'yappingMouthOpen' && state !== 'sing' && state !== 'speechless' && state !== 'worry'
			&& state !== 'dizzy' && state !== 'falling' && state !== 'wallImpact' && state !== 'splat'
			&& state !== 'onTheRun' && state !== 'searching' && state !== 'searchingDown';
	}

	function doesChatPetStateBlink(state, frameIndex) {
		return (state === 'typing' || state === 'buttonPress' || state === 'love')
			&& (state !== 'buttonPress' || frameIndex !== BUTTON_PRESS_FRAME_DURATIONS.length - 1);
	}

	function doesChatPetStateSpeak(state) {
		return state === 'rendering';
	}

	function isChatPetYapState(state) {
		return state === 'yapping' || state === 'yappingMouthOpen';
	}

	function getChatPetSpriteName(state, variant) {
		switch (state) {
			case 'love': return 'buddy-love-' + variant;
			case 'clapping': return 'buddy-clapping-' + variant;
			case 'cool': return 'buddy-cool-' + variant;
			case 'buttonPress': return 'buddy-press-button-' + variant;
			case 'falling': return 'buddy-falling-' + variant;
			case 'jump': return 'buddy-jump-' + variant;
			case 'dizzy': return 'buddy-dizzy-' + variant;
			case 'wallImpact': return 'buddy-wall-impact-' + variant;
			case 'splat': return 'buddy-splat-' + variant;
			case 'onTheRun':
			case 'searching':
			case 'searchingDown': return 'buddy-search-' + variant;
			case 'sleep': return 'buddy-sleep-' + variant;
			case 'waking': return 'buddy-waking-' + variant;
			case 'typing': return 'buddy-typing-' + variant;
			case 'rendering': return 'buddy-rendering-' + variant;
			case 'yappingMouthOpen': return 'buddy-yapping-' + variant;
			case 'sing':
			case 'speechless':
			case 'worry': return 'buddy-' + state + '-' + variant;
			default: return 'buddy-idle-' + variant;
		}
	}

	function getChatPetFrameDurations(state) {
		switch (state) {
			case 'sleep': return SLEEP_FRAME_DURATIONS;
			case 'waking': return WAKE_FRAME_DURATIONS;
			case 'typing': return TYPING_FRAME_DURATIONS;
			case 'buttonPress': return BUTTON_PRESS_FRAME_DURATIONS;
			case 'falling': return FALLING_FRAME_DURATIONS;
			case 'jump': return JUMP_FRAME_DURATIONS;
			case 'splat': return SPLAT_FRAME_DURATIONS;
			case 'rendering': return IDLE_FRAME_DURATIONS;
			case 'clapping': return CLAPPING_FRAME_DURATIONS;
			case 'love': return LOVE_FRAME_DURATIONS;
			case 'cool': return COOL_FRAME_DURATIONS;
			case 'sing': return SING_FRAME_DURATIONS;
			case 'speechless': return SPEECHLESS_FRAME_DURATIONS;
			case 'worry': return WORRY_FRAME_DURATIONS;
			case 'dizzy': return DIZZY_FRAME_DURATIONS;
			case 'searching': return SEARCH_FRAME_DURATIONS;
			case 'onTheRun':
			case 'wallImpact':
			case 'searchingDown':
			case 'yappingMouthOpen':
			case 'yapping': return [];
			default: return IDLE_FRAME_DURATIONS;
		}
	}

	function getChatPetBaseState(idleExpired, typing) {
		// Standalone (no chat model): typing while coding, else idle, else asleep
		// after the idle delay.
		if (typing) { return 'typing'; }
		return idleExpired ? 'sleep' : 'idle';
	}

	function getChatPetRenderedState(baseState, transientState, isDragging) {
		if (isDragging) { return 'idle'; }
		if (isChatPetYapState(transientState) && baseState !== 'idle') { return baseState; }
		return transientState !== undefined ? transientState : baseState;
	}

	function getTransientStateDuration(state) {
		switch (state) {
			case 'buttonPress': return BUTTON_PRESS_STATE_DURATION;
			case 'complete': return COMPLETE_STATE_DURATION;
			case 'splat': return SPLAT_STATE_DURATION;
			case 'love': return LOVE_STATE_DURATION;
			case 'cool': return COOL_STATE_DURATION;
			case 'sing': return SING_STATE_DURATION;
			case 'speechless': return SPEECHLESS_STATE_DURATION;
			case 'worry': return WORRY_STATE_DURATION;
			case 'dizzy': return DIZZY_STATE_DURATION;
			case 'waking': return WAKE_STATE_DURATION;
			default: return TRANSIENT_STATE_DURATION;
		}
	}

	function getChatPetClickInteraction(random, previousInteraction) {
		if (random < ICON_TRANSFORMATION_CHANCE) { return 'complete'; }
		var yappingThreshold = ICON_TRANSFORMATION_CHANCE + YAPPING_CHANCE;
		if (random < yappingThreshold) { return 'yapping'; }
		var available = CLICK_INTERACTIONS.filter(function (i) { return i !== previousInteraction; });
		var normalized = (random - yappingThreshold) / (1 - yappingThreshold);
		return available[Math.min(Math.floor(normalized * available.length), available.length - 1)];
	}

	function getChatPetBlinkDelay(random) {
		var normalized = clamp(random, 0, 1);
		return BLINK_MIN_DELAY + Math.round(normalized * (BLINK_MAX_DELAY - BLINK_MIN_DELAY));
	}

	function getChatPetGazeDirection(cursorX, cursorY, petCenterX, petCenterY) {
		var deltaX = cursorX - petCenterX;
		var deltaY = cursorY - petCenterY;
		var distance = Math.hypot(deltaX, deltaY);
		if (distance === 0) { return [0, 0]; }
		return [Math.round(deltaX / distance), Math.round(deltaY / distance)];
	}

	function getChatPetAnimationFrame(frameDurations, elapsed, iterations, reverse) {
		if (frameDurations.length === 0) { return { frameIndex: 0, complete: true }; }
		var totalDuration = frameDurations.reduce(function (t, d) { return t + d; }, 0);
		var lastFrameIndex = frameDurations.length - 1;
		if (elapsed >= totalDuration * iterations) {
			return { frameIndex: reverse ? 0 : lastFrameIndex, complete: true };
		}
		var iterationElapsed = Math.max(0, elapsed) % totalDuration;
		var frameEnd = 0;
		for (var i = 0; i < frameDurations.length; i++) {
			var frameIndex = reverse ? lastFrameIndex - i : i;
			frameEnd += frameDurations[frameIndex];
			if (iterationElapsed < frameEnd) {
				return { frameIndex: frameIndex, complete: false, nextFrameDelay: frameEnd - iterationElapsed };
			}
		}
		return { frameIndex: reverse ? 0 : lastFrameIndex, complete: false, nextFrameDelay: totalDuration };
	}

	/* ========================================================================== */
	/* Horizontal position + scale                                                */
	/* ========================================================================== */

	function getChatPetHorizontalPosition(left, minimumLeft, maximumLeft) {
		return Math.max(minimumLeft, Math.min(Math.max(minimumLeft, maximumLeft), left));
	}

	function getChatPetDefaultHorizontalPosition(minimumLeft, maximumLeft) {
		return Math.max(minimumLeft, maximumLeft - CHAT_PET_DEFAULT_RIGHT_INSET);
	}

	function getChatPetRestoredHorizontalPosition(relativePosition, minimumLeft, maximumLeft) {
		return relativePosition === undefined
			? getChatPetDefaultHorizontalPosition(minimumLeft, maximumLeft)
			: getChatPetHorizontalPosition(minimumLeft + relativePosition * Math.max(0, maximumLeft - minimumLeft), minimumLeft, maximumLeft);
	}

	function getChatPetRelativeHorizontalPosition(left, minimumLeft, maximumLeft) {
		var range = maximumLeft - minimumLeft;
		if (range <= 0) { return undefined; }
		return clamp((left - minimumLeft) / range, 0, 1);
	}

	function getChatPetHorizontalAnchor(left, minimumLeft, maximumLeft) {
		var clampedLeft = getChatPetHorizontalPosition(left, minimumLeft, maximumLeft);
		var normalizedMax = Math.max(minimumLeft, maximumLeft);
		var leftInset = clampedLeft - minimumLeft;
		var rightInset = normalizedMax - clampedLeft;
		return leftInset <= rightInset ? { edge: 'left', inset: leftInset } : { edge: 'right', inset: rightInset };
	}

	function getChatPetAnchoredHorizontalPosition(anchor, minimumLeft, maximumLeft) {
		var normalizedMax = Math.max(minimumLeft, maximumLeft);
		var left = anchor.edge === 'left' ? minimumLeft + anchor.inset : normalizedMax - anchor.inset;
		return getChatPetHorizontalPosition(left, minimumLeft, normalizedMax);
	}

	function getChatPetScale(scale, delta) {
		return Math.max(CHAT_PET_MIN_SCALE, Math.round((scale + delta) * 10) / 10);
	}

	function getChatPetDragPosition(left, top, minimumLeft, maximumLeft, minimumTop, maximumTop) {
		return [
			getChatPetHorizontalPosition(left, minimumLeft, maximumLeft),
			Math.max(minimumTop, Math.min(Math.max(minimumTop, maximumTop), top)),
		];
	}

	/* ========================================================================== */
	/* Physics                                                                    */
	/* ========================================================================== */

	function getChatPetThrowVelocity(samples, releaseTime) {
		if (samples.length < 2) { return undefined; }
		var latest = samples[samples.length - 1];
		if (releaseTime - latest.time > THROW_RELEASE_GRACE_DURATION) { return undefined; }
		var first = latest;
		for (var index = samples.length - 2; index >= 0; index--) {
			var sample = samples[index];
			if (latest.time - sample.time > THROW_VELOCITY_SAMPLE_DURATION) { break; }
			first = sample;
		}
		var elapsed = Math.max(16, latest.time - first.time);
		var velocityX = (latest.x - first.x) / elapsed * 1000;
		var velocityY = (latest.y - first.y) / elapsed * 1000;
		var speed = Math.hypot(velocityX, velocityY);
		if (speed < THROW_MIN_VELOCITY) { return undefined; }
		var velocityScale = Math.min(1, THROW_MAX_VELOCITY / speed);
		return { x: velocityX * velocityScale, y: velocityY * velocityScale };
	}

	function getChatPetWallReboundVelocity(velocity) {
		return { x: -velocity.x * THROW_WALL_RESTITUTION, y: velocity.y };
	}

	function getChatPetMouseBounceVelocity(motion, pointerVelocity, pointerX, petLeft, petWidth) {
		var petCenter = petLeft + petWidth / 2;
		var horizontalOffset = petWidth > 0 ? clamp((petCenter - pointerX) / (petWidth / 2), -1, 1) : 0;
		var horizontalVelocity = motion.x * MOUSE_BOUNCE_HORIZONTAL_RETENTION
			+ pointerVelocity.x * MOUSE_BOUNCE_HORIZONTAL_TRANSFER
			+ horizontalOffset * MOUSE_BOUNCE_EDGE_KICK;
		var upwardVelocity = Math.max(
			MOUSE_BOUNCE_MIN_UPWARD_VELOCITY,
			Math.max(0, motion.y) * MOUSE_BOUNCE_VERTICAL_RESTITUTION + Math.max(0, -pointerVelocity.y) * MOUSE_BOUNCE_UPWARD_TRANSFER,
		);
		return {
			x: clamp(horizontalVelocity, -MOUSE_BOUNCE_MAX_HORIZONTAL_VELOCITY, MOUSE_BOUNCE_MAX_HORIZONTAL_VELOCITY),
			y: -Math.min(MOUSE_BOUNCE_MAX_UPWARD_VELOCITY, upwardVelocity),
		};
	}

	function isChatPetMouseContact(pointerX, pointerY, bounds) {
		return pointerX >= bounds.left && pointerX <= bounds.right && pointerY >= bounds.top && pointerY <= bounds.bottom;
	}

	function isChatPetMouseBounceEligible(verticalVelocity) {
		return verticalVelocity > 0;
	}

	function advanceChatPetThrow(motion, elapsed, bounds) {
		var duration = Math.max(0, elapsed) / 1000;
		var projectedLeft = motion.left + motion.x * duration;
		var hasHorizontalRange = bounds.maximumLeft > bounds.minimumLeft;
		var wall;
		var motionDuration = duration;
		var left = hasHorizontalRange ? projectedLeft : bounds.minimumLeft;

		if (hasHorizontalRange && projectedLeft < bounds.minimumLeft) {
			wall = 'left';
			motionDuration *= (bounds.minimumLeft - motion.left) / (projectedLeft - motion.left);
			left = bounds.minimumLeft;
		} else if (hasHorizontalRange && projectedLeft > bounds.maximumLeft) {
			wall = 'right';
			motionDuration *= (bounds.maximumLeft - motion.left) / (projectedLeft - motion.left);
			left = bounds.maximumLeft;
		}

		var top = motion.top + motion.y * motionDuration + THROW_GRAVITY * motionDuration * motionDuration / 2;
		var velocityY = motion.y + THROW_GRAVITY * motionDuration;
		if (top < bounds.minimumTop) {
			top = bounds.minimumTop;
			velocityY = Math.abs(velocityY) * THROW_CEILING_RESTITUTION;
		}

		return { left: left, top: top, x: hasHorizontalRange ? motion.x : 0, y: velocityY, wall: wall };
	}

	function getChatPetThrowRotation(rotation, horizontalDistance, verticalVelocity, elapsed) {
		var selfRightingProgress = clamp((verticalVelocity - THROW_SELF_RIGHTING_START_VELOCITY) / -THROW_SELF_RIGHTING_START_VELOCITY, 0, 1);
		var nextRotation = rotation + horizontalDistance * THROW_ROTATION_PER_PIXEL * (1 - selfRightingProgress);
		var uprightRotation = horizontalDistance > 0
			? Math.ceil(nextRotation / 360) * 360
			: horizontalDistance < 0
				? Math.floor(nextRotation / 360) * 360
				: Math.round(nextRotation / 360) * 360;
		var rotationDelta = uprightRotation - nextRotation;
		var maximumCorrection = THROW_SELF_RIGHTING_SPEED * Math.max(0, elapsed) / 1000 * selfRightingProgress;
		return Math.abs(rotationDelta) <= maximumCorrection
			? uprightRotation
			: nextRotation + Math.sign(rotationDelta) * maximumCorrection;
	}

	function shouldSettleChatPetThrow(startTime, currentTime, top, verticalVelocity, floorTop) {
		return currentTime - startTime >= THROW_MAX_DURATION || (top > floorTop && verticalVelocity >= 0);
	}

	function getChatPetThrowLanding(previousLeft, previousTop, left, top, petWidth, petHeight, platformLeft, platformRight, platformTop, floorTop) {
		if (top <= previousTop) { return undefined; }
		var getLeftAtTop = function (targetTop) {
			return previousLeft + (left - previousLeft) * (targetTop - previousTop) / (top - previousTop);
		};
		var platformLandingTop = platformTop - petHeight;
		if (previousTop <= platformLandingTop && top >= platformLandingTop) {
			var landingLeft = getLeftAtTop(platformLandingTop);
			var petCenter = landingLeft + petWidth / 2;
			if (petCenter >= platformLeft && petCenter <= platformRight) {
				return { left: landingLeft, top: platformLandingTop, landsOnPlatform: true };
			}
		}
		if (previousTop <= floorTop && top >= floorTop) {
			return { left: getLeftAtTop(floorTop), top: floorTop, landsOnPlatform: false };
		}
		return undefined;
	}

	function getChatPetFallDuration(distance) {
		return Math.max(180, Math.min(700, Math.sqrt(Math.abs(distance)) * 20));
	}

	function getChatPetMouseCollisionAxisInterval(start, end, minimum, maximum) {
		var delta = end - start;
		if (delta === 0) {
			return start >= minimum && start <= maximum ? [0, 1] : undefined;
		}
		var first = (minimum - start) / delta;
		var second = (maximum - start) / delta;
		var entry = Math.min(first, second);
		var exit = Math.max(first, second);
		if (exit < 0 || entry > 1) { return undefined; }
		return [Math.max(0, entry), Math.min(1, exit)];
	}

	function getChatPetMouseCollisionTime(previousLeft, previousTop, left, top, petWidth, petHeight, pointerX, pointerY) {
		var horizontal = getChatPetMouseCollisionAxisInterval(previousLeft, left, pointerX - petWidth, pointerX);
		var vertical = getChatPetMouseCollisionAxisInterval(previousTop, top, pointerY - petHeight, pointerY);
		if (!horizontal || !vertical) { return undefined; }
		var entry = Math.max(horizontal[0], vertical[0]);
		var exit = Math.min(horizontal[1], vertical[1]);
		return entry <= exit ? entry : undefined;
	}

	function shouldPlaceChatPetSpeechBubbleLeft(state, buttonRight, inputRight, scale) {
		return state === 'rendering' && buttonRight + CHAT_PET_SPEECH_BUBBLE_RIGHT_OVERHANG * scale > inputRight;
	}

	function getChatPetWideSpriteHorizontalOffset(state, facingDirection, buttonLeft, buttonRight, inputLeft, inputRight, scale) {
		var overhang = 0;
		if (state === 'sleep' || state === 'waking') {
			overhang = (CHAT_PET_SLEEP_SOURCE_WIDTH - CHAT_PET_SOURCE_SIZE) / 2;
		} else if (state === 'typing') {
			overhang = (CHAT_PET_TYPING_SOURCE_WIDTH - CHAT_PET_SOURCE_SIZE) / 2;
		} else if (state === 'buttonPress') {
			overhang = (CHAT_PET_BUTTON_PRESS_SOURCE_WIDTH - CHAT_PET_SOURCE_SIZE) / 2;
		} else if (state === 'sing') {
			overhang = (CHAT_PET_SING_SOURCE_WIDTH - CHAT_PET_SOURCE_SIZE) / 2;
		}
		if (overhang === 0) { return 0; }
		return facingDirection === 'left'
			? Math.max(0, overhang - (buttonLeft - inputLeft) / scale)
			: Math.min(0, (inputRight - buttonRight) / scale - overhang);
	}

	function setChatPetWideLayerOffset(offset, layers) {
		var translate = offset === 0 ? '' : offset + 'px';
		for (var i = 0; i < layers.length; i++) {
			if (layers[i]) { layers[i].style.translate = translate; }
		}
	}

	/* ========================================================================== */
	/* Colors                                                                     */
	/* ========================================================================== */

	var colorPresets = [
		{ color: 'stable', label: 'Stable' },
		{ color: 'insiders', label: 'Insiders' },
		{ color: '#ff8c00', label: 'Exploration' },
		{ color: '#e6536f', label: 'Red' },
		{ color: '#e6c94d', label: 'Yellow' },
		{ color: '#55b85a', label: 'Green' },
		{ color: '#a277e6', label: 'Purple' },
		{ color: '#ed83b5', label: 'Pink' },
		{ color: '#ffffff', label: 'White' },
		{ color: '#000000', label: 'Black' },
	];

	function hexToRgba(hex) {
		var h = hex.replace('#', '');
		if (h.length === 3) {
			h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
		}
		var n = parseInt(h, 16);
		return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
	}

	function darken(rgba, factor) {
		return {
			r: Math.round(rgba.r * (1 - factor)),
			g: Math.round(rgba.g * (1 - factor)),
			b: Math.round(rgba.b * (1 - factor)),
			a: rgba.a,
		};
	}

	function relativeLuminance(rgba) {
		function channel(c) {
			c = c / 255;
			return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
		}
		return 0.2126 * channel(rgba.r) + 0.7152 * channel(rgba.g) + 0.0722 * channel(rgba.b);
	}

	function contrastRatio(a, b) {
		var la = relativeLuminance(a);
		var lb = relativeLuminance(b);
		var lighter = Math.max(la, lb);
		var darker = Math.min(la, lb);
		return (lighter + 0.05) / (darker + 0.05);
	}

	function getChatPetBodyColor(color) {
		if (color === 'stable') { return '#23a8f2'; }
		if (color === 'insiders') { return '#24bfa5'; }
		return color;
	}

	function getChatPetEyeColor(color) {
		if (color !== 'stable' && color !== 'insiders' && contrastRatio(hexToRgba(color), hexToRgba('#212324')) < 3) {
			return '#f5f5f5';
		}
		return '#191a1b';
	}

	function getChatPetColorVariant(color) {
		return color === 'insiders' ? 'insiders' : 'stable';
	}

	var coloredSpriteCache = Object.create(null);

	function getChatPetColoredSprite(image, color, key) {
		if (color === 'stable' || color === 'insiders') { return image; }
		var cacheKey = key + '|' + color;
		var cached = coloredSpriteCache[cacheKey];
		if (cached) { return cached; }
		var canvas = document.createElement('canvas');
		canvas.width = image.naturalWidth;
		canvas.height = image.naturalHeight;
		var context = canvas.getContext('2d');
		if (!context) { return image; }
		context.imageSmoothingEnabled = false;
		context.drawImage(image, 0, 0);
		var pixels = context.getImageData(0, 0, canvas.width, canvas.height);
		var body = hexToRgba(color);
		var shade = darken(body, 0.25);
		var shadow = darken(body, 0.5);
		var palette = {};
		palette[0x23a8f2] = body;
		palette[0x24bfa5] = body;
		palette[0x0077b8] = shade;
		palette[0x009a7c] = shade;
		palette[0x004e7c] = shadow;
		palette[0x004538] = shadow;
		palette[0x006451] = shadow;
		palette[0x006652] = shadow;
		var eyeColor = getChatPetEyeColor(color);
		if (eyeColor !== '#191a1b') {
			var eyes = hexToRgba(eyeColor);
			palette[0x191a1b] = eyes;
			palette[0x212324] = eyes;
		}
		var data = pixels.data;
		for (var i = 0; i < data.length; i += 4) {
			if (data[i + 3] === 0) { continue; }
			var replacement = palette[(data[i] << 16) | (data[i + 1] << 8) | data[i + 2]];
			if (replacement) {
				data[i] = replacement.r;
				data[i + 1] = replacement.g;
				data[i + 2] = replacement.b;
			}
		}
		context.putImageData(pixels, 0, 0);
		coloredSpriteCache[cacheKey] = canvas;
		return canvas;
	}

	/* ========================================================================== */
	/* Accessory rig (ported from chatPetAccessoryRig.ts)                         */
	/* ========================================================================== */

	var CHAT_PET_HEAD_WEAR_OFFSET = 8;
	var defaultHeadAnchor = { x: 48, y: 32 };
	var defaultRightEyeAnchor = { x: 56, y: 56 };

	var trackSpans = {
		idle: [
			{ firstFrame: 0, lastFrame: 19, head: defaultHeadAnchor, rightEye: defaultRightEyeAnchor },
			{ firstFrame: 20, lastFrame: 49, head: { x: 48, y: 36 }, rightEye: { x: 56, y: 60 } },
		],
		rendering: [
			{ firstFrame: 0, lastFrame: 19, head: defaultHeadAnchor, rightEye: defaultRightEyeAnchor },
			{ firstFrame: 20, lastFrame: 49, head: { x: 48, y: 36 }, rightEye: { x: 56, y: 60 } },
		],
		sleep: [
			{ firstFrame: 0, lastFrame: 2, head: defaultHeadAnchor, rightEye: { x: 56, y: 64 } },
			{ firstFrame: 3, lastFrame: 7, head: { x: 48, y: 36 }, rightEye: { x: 56, y: 64 } },
		],
		waking: [
			{ firstFrame: 0, lastFrame: 2, head: { x: 48, y: 36 }, pose: 'sleeping', rightEye: { x: 56, y: 64 } },
			{ firstFrame: 3, lastFrame: 7, head: defaultHeadAnchor, pose: 'upright', rightEye: defaultRightEyeAnchor },
		],
		love: [
			{ firstFrame: 0, lastFrame: 3, head: { x: 48, y: 36 } },
			{ firstFrame: 4, lastFrame: 5, head: defaultHeadAnchor },
		],
		jump: [
			{ firstFrame: 0, lastFrame: 0, head: defaultHeadAnchor, rightEye: { x: 56, y: 56 } },
			{ firstFrame: 1, lastFrame: 1, head: { x: 48, y: 48 }, rightEye: { x: 56, y: 64 } },
			{ firstFrame: 2, lastFrame: 2, head: defaultHeadAnchor, rightEye: { x: 56, y: 48 } },
			{ firstFrame: 3, lastFrame: 3, head: defaultHeadAnchor, rightEye: { x: 56, y: 40 } },
			{ firstFrame: 4, lastFrame: 4, head: { x: 48, y: 56 }, rightEye: { x: 56, y: 64 } },
			{ firstFrame: 5, lastFrame: 5, head: defaultHeadAnchor, rightEye: { x: 56, y: 56 } },
		],
		cool: [
			{ firstFrame: 0, lastFrame: 1, head: defaultHeadAnchor },
			{ firstFrame: 2, lastFrame: 2, head: { x: 48, y: 36 } },
			{ firstFrame: 3, lastFrame: 8, head: defaultHeadAnchor },
		],
		sing: [
			{ firstFrame: 0, lastFrame: 3, head: { x: 48, y: 52 }, rightEye: { x: 56, y: 72 } },
		],
		worry: [
			{ firstFrame: 0, lastFrame: 0, head: defaultHeadAnchor },
			{ firstFrame: 1, lastFrame: 1, head: defaultHeadAnchor, mirrorsHeadAccessory: true },
		],
		dizzy: [
			{ firstFrame: 0, lastFrame: 7, head: { x: 48, y: 48 }, hideEyeAccessory: true },
		],
		falling: [
			{ firstFrame: 0, lastFrame: 5, head: defaultHeadAnchor, rightEye: { x: 48, y: 48 } },
		],
		splat: [
			{ firstFrame: 0, lastFrame: 0, head: { x: 48, y: 72 }, pose: 'splat', hideEyeAccessory: true },
			{ firstFrame: 1, lastFrame: 1, head: { x: 48, y: 64 }, pose: 'splat', hideEyeAccessory: true },
			{ firstFrame: 2, lastFrame: 2, head: { x: 48, y: 48 }, pose: 'splat', hideEyeAccessory: true },
			{ firstFrame: 3, lastFrame: 3, head: defaultHeadAnchor, pose: 'upright' },
		],
	};

	function getChatPetAccessoryTrack(state) {
		switch (state) {
			case 'sleep':
			case 'waking':
			case 'typing':
			case 'rendering':
			case 'love':
			case 'clapping':
			case 'jump':
			case 'cool':
			case 'sing':
			case 'speechless':
			case 'worry':
			case 'dizzy':
			case 'falling':
			case 'splat':
				return state;
			case 'buttonPress':
				return 'buttonPress';
			case 'yappingMouthOpen':
				return 'yapping';
			case 'wallImpact':
				return 'wallImpact';
			case 'onTheRun':
			case 'searching':
			case 'searchingDown':
				return 'search';
			case 'complete':
			case 'yapping':
			case 'idle':
				return 'idle';
		}
		return 'idle';
	}

	function getDefaultChatPetAccessoryRigPose(state) {
		switch (state) {
			case 'sleep':
			case 'waking': return 'sleeping';
			case 'jump':
			case 'dizzy':
			case 'falling': return 'airborne';
			case 'wallImpact': return 'impact';
			case 'splat': return 'splat';
			default: return 'upright';
		}
	}

	function doesChatPetStateHideEyeAccessory(state) {
		return state === 'love'
			|| state === 'complete'
			|| state === 'cool'
			|| state === 'speechless'
			|| state === 'worry'
			|| state === 'dizzy'
			|| state === 'wallImpact';
	}

	function getChatPetAccessoryRigFrame(state, frameIndex) {
		var spans = trackSpans[getChatPetAccessoryTrack(state)];
		var span;
		if (spans) {
			for (var i = 0; i < spans.length; i++) {
				if (frameIndex >= spans[i].firstFrame && frameIndex <= spans[i].lastFrame) { span = spans[i]; break; }
			}
		}
		var trackedHead = span ? span.head : defaultHeadAnchor;
		var hideEyeAccessory = (span && span.hideEyeAccessory) || doesChatPetStateHideEyeAccessory(state);
		var result = {
			pose: span && span.pose ? span.pose : getDefaultChatPetAccessoryRigPose(state),
			rightEye: hideEyeAccessory ? undefined : (span && span.rightEye ? span.rightEye : defaultRightEyeAnchor),
		};
		if (state === 'love' || state === 'complete' || state === 'dizzy') {
			result.head = undefined;
		} else {
			result.head = { x: trackedHead.x, y: trackedHead.y + CHAT_PET_HEAD_WEAR_OFFSET };
		}
		if (span && span.mirrorsHeadAccessory) { result.mirrorsHeadAccessory = true; }
		return result;
	}

	function getChatPetAntennaeOcclusionBounds(state, frameIndex) {
		var rigFrame = getChatPetAccessoryRigFrame(state, frameIndex);
		if (!rigFrame.head) { return undefined; }
		if (rigFrame.pose === 'impact') {
			return { x: 16, y: 24, width: 64, height: 8 };
		}
		return { x: rigFrame.head.x - 32, y: rigFrame.head.y - 48, width: 64, height: 40 };
	}

	function getChatPetEyeAccessoryAnchor(state, frameIndex, facingDirection, mirrorsWithFacing, frameWidth) {
		var anchor = getChatPetAccessoryRigFrame(state, frameIndex).rightEye;
		if (!anchor || facingDirection === 'right' || mirrorsWithFacing) { return anchor; }
		return { x: anchor.x - 16 + frameWidth - 96, y: anchor.y };
	}

	function getChatPetReducedMotionRigFrame(state) {
		switch (state) {
			case 'sleep': return 4;
			case 'waking': return 7;
			case 'buttonPress': return 4;
			case 'love': return 5;
			case 'splat': return 3;
			default: return 0;
		}
	}

	/* ========================================================================== */
	/* Accessory renderer (ported from chatPetAccessoryRenderer.ts)               */
	/* ========================================================================== */

	var rigPoseColumn = { upright: 0, sleeping: 1, airborne: 0, impact: 2, splat: 3 };
	var compactHeadPivot = { upright: [32, 48], sleeping: [32, 48], airborne: [32, 48], impact: [32, 32], splat: [32, 48] };
	var wideHeadPivot = { upright: [48, 40], sleeping: [48, 40], airborne: [48, 40], impact: [48, 40], splat: [48, 80] };

	function getAtlasCellSize(atlasImage) {
		return atlasImage.naturalWidth / 4;
	}

	function drawAccessoryLayer(context, atlasImage, rigFrame, layer) {
		var cellSize = getAtlasCellSize(atlasImage);
		var sourceX = rigPoseColumn[rigFrame.pose] * cellSize;
		if (rigFrame.head) {
			var headSourceY = (layer === 'back' ? 0 : 1) * cellSize;
			var pivot = cellSize === 96 ? wideHeadPivot[rigFrame.pose] : compactHeadPivot[rigFrame.pose];
			context.drawImage(
				atlasImage,
				sourceX, headSourceY, cellSize, cellSize,
				rigFrame.head.x - pivot[0], rigFrame.head.y - pivot[1], cellSize, cellSize,
			);
		}
	}

	function drawTrackedAccessoryLayer(context, atlasImage, rigFrame, layer, frameWidth) {
		if (rigFrame.mirrorsHeadAccessory) {
			drawMirroredAccessoryLayer(context, atlasImage, rigFrame, layer, frameWidth);
		} else {
			drawAccessoryLayer(context, atlasImage, rigFrame, layer);
		}
	}

	function drawMirroredAccessoryLayer(context, atlasImage, rigFrame, layer, frameWidth) {
		context.save();
		context.translate(frameWidth, 0);
		context.scale(-1, 1);
		drawAccessoryLayer(context, atlasImage, rigFrame, layer);
		context.restore();
	}

	function drawEyeAccessory(context, atlasImage, rigFrame, eyeAnchor) {
		var anchor = eyeAnchor !== undefined ? eyeAnchor : rigFrame.rightEye;
		if (!anchor) { return; }
		var cellSize = getAtlasCellSize(atlasImage);
		var sourceX = rigPoseColumn[rigFrame.pose] * cellSize;
		context.drawImage(atlasImage, sourceX, 2 * cellSize, cellSize, cellSize, anchor.x, anchor.y, cellSize, cellSize);
	}

	function drawMirroredEyeAccessory(context, atlasImage, rigFrame, frameWidth) {
		context.save();
		context.translate(frameWidth, 0);
		context.scale(-1, 1);
		drawEyeAccessory(context, atlasImage, rigFrame);
		context.restore();
	}

	function drawMirroredChatPetLayer(context, image, sourceX, sourceY, frameWidth, frameHeight) {
		context.save();
		context.translate(frameWidth, 0);
		context.scale(-1, 1);
		context.drawImage(image, sourceX, sourceY, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
		context.restore();
	}

	function clearChatPetAntennae(context, state, frameIndex, frameWidth, mirrored) {
		var bounds = getChatPetAntennaeOcclusionBounds(state, frameIndex);
		if (!bounds) { return; }
		var x = mirrored ? frameWidth - bounds.x - bounds.width : bounds.x;
		context.clearRect(x, bounds.y, bounds.width, bounds.height);
	}

	function drawFixedOrientationDecorations(context, bodyImage, frameIndex, frameWidth, decorations) {
		for (var d = 0; d < decorations.length; d++) {
			var decoration = decorations[d];
			var currentBounds = decoration.frameBounds[frameIndex];
			var canonicalBounds = decoration.frameBounds[decoration.sourceFrame];
			var canonicalWidth = canonicalBounds[2] - canonicalBounds[0];
			var canonicalHeight = canonicalBounds[3] - canonicalBounds[1];
			context.clearRect(frameWidth - currentBounds[2], currentBounds[1], currentBounds[2] - currentBounds[0], currentBounds[3] - currentBounds[1]);
			context.drawImage(
				bodyImage,
				decoration.sourceFrame * frameWidth + canonicalBounds[0], canonicalBounds[1], canonicalWidth, canonicalHeight,
				frameWidth - currentBounds[0] - canonicalWidth, currentBounds[1], canonicalWidth, canonicalHeight,
			);
		}
	}

	function drawChatPetComposite(context, bodyImage, accessoryImage, bodyFrameIndex, rigFrameIndex, frameWidth, frameHeight, facingDirection, state, fixedOrientationDecorations, includeEyeAccessory, eyeAccessoryMirrorsWithFacing, coversAntennae, color, spriteKey) {
		context.clearRect(0, 0, frameWidth, frameHeight);
		var sourceX = bodyFrameIndex * frameWidth;
		var coloredBody = color ? getChatPetColoredSprite(bodyImage, color, spriteKey) : bodyImage;
		var rigFrame = getChatPetAccessoryRigFrame(state, rigFrameIndex);
		if (fixedOrientationDecorations !== undefined && facingDirection === 'left') {
			drawMirroredChatPetLayer(context, coloredBody, sourceX, 0, frameWidth, frameHeight);
			drawFixedOrientationDecorations(context, coloredBody, bodyFrameIndex, frameWidth, fixedOrientationDecorations);
			if (accessoryImage) {
				if (coversAntennae) { clearChatPetAntennae(context, state, rigFrameIndex, frameWidth, true); }
				context.save();
				context.globalCompositeOperation = 'destination-over';
				drawMirroredAccessoryLayer(context, accessoryImage, rigFrame, 'back', frameWidth);
				context.restore();
				drawMirroredAccessoryLayer(context, accessoryImage, rigFrame, 'front', frameWidth);
				if (includeEyeAccessory) {
					if (eyeAccessoryMirrorsWithFacing) {
						drawMirroredEyeAccessory(context, accessoryImage, rigFrame, frameWidth);
					} else {
						drawEyeAccessory(context, accessoryImage, rigFrame, getChatPetEyeAccessoryAnchor(state, rigFrameIndex, 'left', false, frameWidth));
					}
				}
			}
			return;
		}
		if (accessoryImage) {
			drawTrackedAccessoryLayer(context, accessoryImage, rigFrame, 'back', frameWidth);
		}
		context.drawImage(coloredBody, sourceX, 0, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
		if (accessoryImage) {
			if (coversAntennae) {
				clearChatPetAntennae(context, state, rigFrameIndex, frameWidth, false);
				context.save();
				context.globalCompositeOperation = 'destination-over';
				drawTrackedAccessoryLayer(context, accessoryImage, rigFrame, 'back', frameWidth);
				context.restore();
			}
			drawTrackedAccessoryLayer(context, accessoryImage, rigFrame, 'front', frameWidth);
			if (includeEyeAccessory) {
				drawEyeAccessory(context, accessoryImage, rigFrame);
			}
		}
	}

	function drawChatPetEyeAccessory(context, accessoryImage, state, frameIndex, facingDirection, mirrorsWithFacing, gazeOffset) {
		context.clearRect(0, 0, context.canvas.width, context.canvas.height);
		var rigFrame = getChatPetAccessoryRigFrame(state, frameIndex);
		if (facingDirection === 'left' && mirrorsWithFacing) {
			drawMirroredEyeAccessory(context, accessoryImage, rigFrame, context.canvas.width);
			return;
		}
		var anchor = getChatPetEyeAccessoryAnchor(state, frameIndex, facingDirection, mirrorsWithFacing, context.canvas.width);
		drawEyeAccessory(context, accessoryImage, rigFrame, anchor && gazeOffset ? { x: anchor.x + gazeOffset[0], y: anchor.y + gazeOffset[1] } : anchor);
	}

	/* ========================================================================== */
	/* Accessory catalog                                                          */
	/* ========================================================================== */

	var accessoryCatalog = [
		{ id: 'topHatMonocle', label: 'Grand Top Hat & Monocle', atlasName: 'grand-top-hat-monocle', eyeAccessoryMirrorsWithFacing: false, coversAntennae: true },
		{ id: 'cowboyHat', label: 'Cowboy Hat', atlasName: 'cowboy-hat', coversAntennae: true },
		{ id: 'baseballCap', label: 'Baseball Cap', atlasName: 'baseball-cap', coversAntennae: true },
		{ id: 'constructionHardHat', label: 'Construction Hard Hat', atlasName: 'construction-hard-hat', coversAntennae: true },
		{ id: 'firefighterHelmet', label: 'Firefighter Helmet', atlasName: 'firefighter-helmet', coversAntennae: true },
		{ id: 'crown', label: 'Crown', atlasName: 'crown', coversAntennae: true },
		{ id: 'propellerHat', label: 'Propeller Hat', atlasName: 'propeller-hat', coversAntennae: true },
		{ id: 'darkSailorHat', label: 'Dark Sailor Hat', atlasName: 'dark-sailor-hat', coversAntennae: true },
		{ id: 'whiteChefHat', label: 'White Chef Hat', atlasName: 'white-chef-hat', coversAntennae: true },
		{ id: 'bambooHat', label: 'Bamboo Hat', atlasName: 'bamboo-hat', coversAntennae: true },
		{ id: 'strawHat', label: 'Straw Hat', atlasName: 'straw-hat', coversAntennae: true },
		{ id: 'pinkPartyHat', label: 'Pink Party Hat', atlasName: 'pink-party-hat', coversAntennae: true },
		{ id: 'wizardHat', label: 'Wizard Hat', atlasName: 'wizard-hat', coversAntennae: true },
		{ id: 'sailorHat', label: 'Sailor Hat', atlasName: 'sailor-hat', coversAntennae: true },
		{ id: 'spinnerHat', label: 'Spinner Hat', atlasName: 'full-size-spinner-hat', coversAntennae: true },
		{ id: 'partyHat', label: 'Party Hat', atlasName: 'leaning-party-hat', coversAntennae: true },
		{ id: 'artistBeret', label: 'Artist Beret', atlasName: 'artist-beret', coversAntennae: true },
	];

	function getAccessory(id) {
		for (var i = 0; i < accessoryCatalog.length; i++) {
			if (accessoryCatalog[i].id === id) { return accessoryCatalog[i]; }
		}
		return undefined;
	}

	/* ========================================================================== */
	/* Controllers                                                                */
	/* ========================================================================== */

	function BlinkController(onBlinkChange) {
		var enabled = false;
		var blinking = false;
		var timer = null;

		function setBlinking(value) {
			if (blinking === value) { return; }
			blinking = value;
			onBlinkChange(blinking);
		}

		function scheduleBlink() {
			clearTimeout(timer);
			timer = setTimeout(function () {
				if (enabled) { setBlinking(true); }
			}, getChatPetBlinkDelay(Math.random()));
		}

		this.setEnabled = function (value) {
			if (enabled === value) { return; }
			enabled = value;
			clearTimeout(timer);
			setBlinking(false);
			if (enabled) { scheduleBlink(); }
		};

		this.onAnimationComplete = function () {
			if (!blinking) { return; }
			setBlinking(false);
			if (enabled) { scheduleBlink(); }
		};

		this.reset = function () {
			enabled = false;
			blinking = false;
			clearTimeout(timer);
		};
	}

	function FacingController() {
		var direction = 'right';
		var tracksCursor = false;

		this.direction = function () { return direction; };
		this.setDirection = function (d) { direction = d; };
		this.setState = function (state, isDragging) { tracksCursor = state === 'idle' && !isDragging; };
		this.snapToCursor = function (cursorX, petCenterX) {
			if (cursorX < petCenterX) { direction = 'left'; }
			else if (cursorX > petCenterX) { direction = 'right'; }
			return direction;
		};
		this.update = function (cursorX, petCenterX) {
			if (tracksCursor) { return this.snapToCursor(cursorX, petCenterX); }
			return direction;
		};
	}

	function DirectionChangeController() {
		var lastDirection;
		var lastDirectionChangeTime;
		var directionChangeCount = 0;

		this.record = function (direction, timestamp) {
			if (lastDirection === direction) { return false; }
			if (lastDirection === undefined) {
				lastDirection = direction;
				lastDirectionChangeTime = timestamp;
				return false;
			}
			if (lastDirectionChangeTime !== undefined && timestamp - lastDirectionChangeTime > DIZZY_DIRECTION_CHANGE_MAX_INTERVAL) {
				directionChangeCount = 0;
			}
			lastDirection = direction;
			lastDirectionChangeTime = timestamp;
			directionChangeCount++;
			if (directionChangeCount < DIZZY_DIRECTION_CHANGE_COUNT) { return false; }
			this.reset();
			return true;
		};

		this.reset = function () {
			lastDirection = undefined;
			lastDirectionChangeTime = undefined;
			directionChangeCount = 0;
		};
	}

	/* ========================================================================== */
	/* Sprite sources                                                             */
	/* ========================================================================== */

	var spriteSourceCache = Object.create(null);

	function buildSpriteSource(variant, state) {
		var cacheKey = variant + '|' + state;
		var cached = spriteSourceCache[cacheKey];
		if (cached) { return cached; }

		var name = getChatPetSpriteName(state, variant);
		var tracksCursor = doesChatPetStateTrackCursor(state);
		var suffix = tracksCursor ? '-tracking-96' : '-96';
		var sourceWidth = CHAT_PET_SOURCE_SIZE;
		var sourceHeight = CHAT_PET_SOURCE_SIZE;
		var fixedOrientationDecorations;

		if (state === 'sleep' || state === 'waking') {
			sourceWidth = CHAT_PET_SLEEP_SOURCE_WIDTH;
		} else if (state === 'typing') {
			sourceWidth = CHAT_PET_TYPING_SOURCE_WIDTH;
		} else if (state === 'buttonPress') {
			sourceWidth = CHAT_PET_BUTTON_PRESS_SOURCE_WIDTH;
		} else if (state === 'sing') {
			sourceWidth = CHAT_PET_SING_SOURCE_WIDTH;
			sourceHeight = CHAT_PET_SING_SOURCE_HEIGHT;
			suffix = '-124';
			fixedOrientationDecorations = SING_FIXED_ORIENTATION_DECORATIONS;
		} else if (state === 'dizzy') {
			sourceHeight = CHAT_PET_DIZZY_SOURCE_HEIGHT;
			suffix = '-128';
		}

		var frameDurations = getChatPetFrameDurations(state);
		var frameWidth = sourceWidth;
		var staticUrl = SPRITES[name + suffix + '.png'];
		var animatedUrl = SPRITES[name + suffix + '.spritesheet.png'];

		var staticSource = {
			url: staticUrl,
			frameWidth: frameWidth,
			frameHeight: sourceHeight,
			fixedOrientationDecorations: fixedOrientationDecorations,
			frameDurations: [],
			iterations: 1,
			accessoryRigFrame: getChatPetReducedMotionRigFrame(state),
		};

		var oneShot = state === 'waking' || state === 'buttonPress' || state === 'cool' || state === 'splat' || state === 'searching' || state === 'jump';

		var source = {
			animated: frameDurations.length === 0 || !animatedUrl ? staticSource : {
				url: animatedUrl,
				frameWidth: frameWidth,
				frameHeight: sourceHeight,
				fixedOrientationDecorations: fixedOrientationDecorations,
				frameDurations: frameDurations,
				iterations: oneShot ? 1 : Infinity,
			},
			reducedMotion: staticSource,
		};
		spriteSourceCache[cacheKey] = source;
		return source;
	}

	function buildSpeechSource(variant) {
		var name = 'buddy-speech-' + variant + '-96';
		var animatedUrl = SPRITES[name + '.spritesheet.png'];
		var staticUrl = SPRITES[name + '.png'];
		return {
			animated: { url: animatedUrl, frameWidth: CHAT_PET_SOURCE_SIZE, frameDurations: SPEECH_FRAME_DURATIONS, iterations: Infinity },
			reducedMotion: { url: staticUrl, frameWidth: CHAT_PET_SOURCE_SIZE, frameDurations: [], iterations: 1 },
		};
	}

	function buildRespawnSource(variant) {
		var name = 'buddy-respawn-' + variant + '-96';
		var animatedUrl = SPRITES[name + '.spritesheet.png'];
		var staticUrl = SPRITES[name + '.png'];
		return {
			animated: { url: animatedUrl, frameWidth: CHAT_PET_SOURCE_SIZE, frameDurations: RESPAWN_FRAME_DURATIONS, iterations: 1 },
			reducedMotion: { url: staticUrl, frameWidth: CHAT_PET_SOURCE_SIZE, frameDurations: [], iterations: 1 },
		};
	}

	/* ========================================================================== */
	/* Persistence                                                                */
	/* ========================================================================== */

	var STORAGE_PREFIX = 'betterPet.editor.';
	function storageGet(key) {
		try { return window.localStorage.getItem(STORAGE_PREFIX + key); } catch (e) { return null; }
	}
	function storageSet(key, value) {
		try { window.localStorage.setItem(STORAGE_PREFIX + key, value); } catch (e) { /* ignore */ }
	}

	function readScale() {
		var stored = storageGet('scale');
		var scale = stored === null ? NaN : parseFloat(stored);
		return Number.isFinite(scale) && scale > 0 ? scale : CHAT_PET_DEFAULT_SCALE;
	}
	function readHorizontalPosition() {
		var stored = storageGet('horizontalPosition');
		if (stored === null || stored === '') { return undefined; }
		var value = parseFloat(stored);
		return Number.isFinite(value) && value >= 0 && value <= 1 ? value : undefined;
	}
	function readColor() {
		var stored = storageGet('color');
		if (!stored) { return 'stable'; }
		if (stored === 'stable' || stored === 'insiders') { return stored; }
		if (/^#[0-9a-f]{6}$/i.test(stored)) { return stored.toLowerCase(); }
		return 'stable';
	}
	function readAccessory() {
		var stored = storageGet('accessory');
		return stored && getAccessory(stored) ? stored : undefined;
	}

	/* ========================================================================== */
	/* Confetti (faithful port of triggerConfettiAnimation from                  */
	/* src/vs/base/browser/ui/animations/animations.ts)                          */
	/* ========================================================================== */

	var CONFETTI_COLORS = [
		'var(--vscode-charts-red)',
		'var(--vscode-charts-orange)',
		'var(--vscode-charts-yellow)',
		'var(--vscode-charts-green)',
		'var(--vscode-charts-blue)',
		'var(--vscode-charts-purple)',
	];

	var defaultConfettiLaunchDuration = { min: 280, max: 380 };
	var defaultConfettiFallDuration = { min: 1700, max: 2100 };
	var defaultConfettiFallDistance = { min: 90, max: 130 };

	function randomInRange(range) {
		return range.min + Math.random() * (range.max - range.min);
	}

	function bounceElement(element, opts) {
		if (!element || typeof element.animate !== 'function') { return; }
		var steps = Math.max(
			opts.scale ? opts.scale.length : 0,
			opts.rotate ? opts.rotate.length : 0,
			opts.translateY ? opts.translateY.length : 0,
		);
		if (steps === 0) { return; }
		var frames = [];
		for (var i = 0; i < steps; i++) {
			var frame = { offset: steps === 1 ? 1 : i / (steps - 1) };
			var parts = '';
			if (opts.scale && opts.scale[i] !== undefined) { parts += 'scale(' + opts.scale[i] + ')'; }
			if (opts.rotate && opts.rotate[i] !== undefined) { parts += ' rotate(' + opts.rotate[i] + 'deg)'; }
			if (opts.translateY && opts.translateY[i] !== undefined) { parts += ' translateY(' + opts.translateY[i] + 'px)'; }
			if (parts) { frame.transform = parts.trim(); }
			frames.push(frame);
		}
		element.animate(frames, {
			duration: opts.duration || 350,
			easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
			fill: 'forwards',
		});
	}

	function triggerConfetti(target, options) {
		if (!target || typeof target.animate !== 'function') { return; }
		var element = target;
		var rect = target.getBoundingClientRect();
		var container = element.closest('.monaco-workbench') || document.body;
		var launchDuration = (options && options.launchDuration) || defaultConfettiLaunchDuration;
		var fallDuration = (options && options.fallDuration) || defaultConfettiFallDuration;
		var fallDistance = (options && options.fallDistance) || defaultConfettiFallDistance;

		// Element bounce.
		bounceElement(element, { scale: [1, 1.3, 1], rotate: [0, -10, 10, 0], duration: 350 });

		var overlay = document.createElement('div');
		overlay.className = 'animation-overlay';
		overlay.style.position = 'fixed';
		overlay.style.left = rect.left + 'px';
		overlay.style.top = rect.top + 'px';
		overlay.style.width = rect.width + 'px';
		overlay.style.height = rect.height + 'px';
		overlay.style.pointerEvents = 'none';
		overlay.style.overflow = 'visible';
		overlay.style.zIndex = '10000';
		container.appendChild(overlay);

		var cx = rect.width / 2;
		var cy = rect.height / 2;
		var particleCount = 24;
		for (var i = 0; i < particleCount; i++) {
			var width = 4 + (i % 3) * 1.5;
			var height = 3 + ((i + 1) % 3);
			var angle = (-160 + Math.random() * 140) * Math.PI / 180;
			var distance = 30 + Math.random() * 30;
			var peakX = Math.cos(angle) * distance;
			var peakY = Math.sin(angle) * distance;
			var endX = peakX * 1.4 + (Math.random() - 0.5) * 20;
			var endY = peakY + randomInRange(fallDistance);
			var rotation = (Math.random() - 0.5) * 720;
			var particleLaunchDuration = randomInRange(launchDuration);
			var particleFallDuration = randomInRange(fallDuration);
			var particleDuration = particleLaunchDuration + particleFallDuration;
			var launchMidpointOffset = particleLaunchDuration * 0.4 / particleDuration;
			var apexOffset = particleLaunchDuration / particleDuration;

			var part = document.createElement('div');
			part.className = 'animation-particle animation-confetti-particle';
			part.style.position = 'absolute';
			part.style.width = width + 'px';
			part.style.height = height + 'px';
			part.style.borderRadius = i % 4 === 0 ? '50%' : '1px';
			part.style.backgroundColor = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
			part.style.left = cx + 'px';
			part.style.top = cy + 'px';
			overlay.appendChild(part);

			var keyframes = [
				{ opacity: 0, transform: 'translate(-50%, -50%) scale(0) rotate(0deg)', easing: 'cubic-bezier(0.15, 0.75, 0.25, 1)' },
				{ opacity: 1, transform: 'translate(calc(-50% + ' + (peakX * 0.35) + 'px), calc(-50% + ' + (peakY * 0.55) + 'px)) scale(1) rotate(' + (rotation * 0.2) + 'deg)', offset: launchMidpointOffset, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
				{ opacity: 1, transform: 'translate(calc(-50% + ' + peakX + 'px), calc(-50% + ' + peakY + 'px)) rotate(' + (rotation * 0.5) + 'deg)', offset: apexOffset, easing: 'linear' },
				{ opacity: 0, transform: 'translate(calc(-50% + ' + endX + 'px), calc(-50% + ' + endY + 'px)) rotate(' + rotation + 'deg)' },
			];

			part.animate(keyframes, {
				duration: particleDuration,
				delay: Math.random() * 100,
				fill: 'both',
			});
		}

		window.setTimeout(function () { overlay.remove(); }, launchDuration.max + fallDuration.max + 200);
	}

	/* ========================================================================== */
	/* Status announcements                                                       */
	/* ========================================================================== */

	var liveRegion = document.createElement('div');
	liveRegion.setAttribute('role', 'status');
	liveRegion.setAttribute('aria-live', 'polite');
	liveRegion.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;';
	ROOT.appendChild(liveRegion);

	function status(message) {
		try { liveRegion.textContent = ''; liveRegion.textContent = message; } catch (e) { /* ignore */ }
	}

	/* ========================================================================== */
	/* The widget                                                                 */
	/* ========================================================================== */

	function ChatPet(root) {
		var self = this;

		/* --- state ----------------------------------------------------------- */
		var enabled = true;
		var motionReduced = false;
		var variant = 'stable';
		var color = readColor();
		var scale = readScale();
		var selectedAccessory = readAccessory();
		var onTheRun = false;
		var cursorRun = false; // on-the-run entered automatically because cornered
		var horizontalPosition = readHorizontalPosition();

		var idleExpired = false;
		var transientState;
		var isDragging = false;
		var lastClickInteraction;
		var bounceCount = 0;
		var bounceResultVisible = false;
		var renderedState;
		var suppressNextPointerClick = false;
		var typingActive = false;
		var typingTimer = null;
		var baseLeft = 0;
		var avoidanceTimer = null;

		/* --- physics state --------------------------------------------------- */
		var cursorPosition;
		var cursorSamples = [];
		var cursorContactingPet = false;
		var mouseBounceArmed = false;
		var mouseBounceAvailableAt = 0;
		var throwAnimationId = 0;
		var throwBounceHandler;
		var throwWallImpact;
		var throwGeometryDirty = false;
		var fallLandsOnPlatform = false;
		var hasCustomPosition = false;
		var horizontalAnchor;
		var activeFrameIndex = 0;
		var activeSprite;
		var activeSource;
		var pendingRender;
		var renderGeneration = 0;
		var accessoryGeneration = 0;
		var failedAccessorySources = Object.create(null);
		var spriteAnimationId = 0;
		var speechAnimationId = 0;
		var bodyAnimationCancel;
		var speechAnimationCancel;
		var eyeAccessoryVisible = false;
		var eyeAccessoryFixedOrientation = false;
		var eyeAccessoryGazeOffset = [0, 0];
		var redrawEyeAccessory;

		/* --- timers ---------------------------------------------------------- */
		var idleTimer = null;
		var transientTimer = null;
		var bounceResultTimer = null;
		var clickSuppressionTimer = null;

		/* --- controllers ------------------------------------------------------ */
		var blinkController = new BlinkController(function (blinking) {
			eyes.classList.toggle('blink', blinking);
		});
		var facingController = new FacingController();
		var directionChangeController = new DirectionChangeController();

		/* --- DOM -------------------------------------------------------------- */
		var overlay = document.createElement('div');
		overlay.className = 'chat-pet-overlay';
		root.appendChild(overlay);

		var button = document.createElement('button');
		button.type = 'button';
		button.className = 'chat-pet-button';
		button.setAttribute('data-facing', facingController.direction());
		button.setAttribute('aria-label', 'Interact with the VS Code pet');
		overlay.appendChild(button);

		var visual = document.createElement('div');
		visual.className = 'chat-pet-visual';
		button.appendChild(visual);

		var bounceCounter = document.createElement('span');
		bounceCounter.className = 'chat-pet-bounce-counter hidden';
		bounceCounter.setAttribute('aria-hidden', 'true');
		overlay.appendChild(bounceCounter);

		var confettiAnchor = document.createElement('div');
		confettiAnchor.className = 'chat-pet-confetti-anchor';
		confettiAnchor.setAttribute('aria-hidden', 'true');
		overlay.appendChild(confettiAnchor);

		// Two sprite buffers for seamless state transitions.
		var sprites = [];
		for (var s = 0; s < 2; s++) {
			var container = document.createElement('div');
			container.className = 'chat-pet-sprite hidden';
			var canvas = document.createElement('canvas');
			canvas.className = 'chat-pet-canvas';
			canvas.width = CHAT_PET_SOURCE_SIZE;
			canvas.height = CHAT_PET_SOURCE_SIZE;
			canvas.setAttribute('aria-hidden', 'true');
			container.appendChild(canvas);
			var image = new Image();
			image.className = 'chat-pet-spritesheet';
			image.alt = '';
			image.setAttribute('aria-hidden', 'true');
			var accessoryImages = [new Image(), new Image()];
			var sprite = { container: container, canvas: canvas, image: image, accessoryImages: accessoryImages, activeAccessory: undefined, activeAccessoryImage: undefined, redrawFrame: undefined };
			image.addEventListener('load', function (spr) { return function () { onBodyImageLoad(spr); }; }(sprite));
			image.addEventListener('error', function (spr) { return function () { onBodyImageError(spr); }; }(sprite));
			for (var a = 0; a < accessoryImages.length; a++) {
				accessoryImages[a].className = 'chat-pet-spritesheet';
				accessoryImages[a].alt = '';
				accessoryImages[a].setAttribute('aria-hidden', 'true');
				accessoryImages[a].addEventListener('load', function (spr, img) { return function () { onAccessoryImageLoad(spr, img); }; }(sprite, accessoryImages[a]));
				accessoryImages[a].addEventListener('error', function (spr, img) { return function () { onAccessoryImageError(spr, img); }; }(sprite, accessoryImages[a]));
			}
			container.appendChild(image);
			for (var a2 = 0; a2 < accessoryImages.length; a2++) { container.appendChild(accessoryImages[a2]); }
			visual.appendChild(container);
			sprites.push(sprite);
		}

		var eyes = document.createElement('div');
		eyes.className = 'chat-pet-eyes';
		eyes.setAttribute('aria-hidden', 'true');
		eyes.style.color = getChatPetEyeColor(color);
		visual.appendChild(eyes);
		var pupils = [];
		['left', 'right'].forEach(function (side) {
			var eye = document.createElement('div');
			eye.className = 'chat-pet-eye ' + side;
			var pupil = document.createElement('div');
			pupil.className = 'chat-pet-pupil';
			eye.appendChild(pupil);
			eyes.appendChild(eye);
			pupils.push(pupil);
		});

		var eyeAccessoryContainer = document.createElement('div');
		eyeAccessoryContainer.className = 'chat-pet-eye-accessory hidden';
		var eyeAccessory = document.createElement('canvas');
		eyeAccessory.className = 'chat-pet-eye-accessory-canvas';
		eyeAccessory.width = CHAT_PET_SOURCE_SIZE;
		eyeAccessory.height = CHAT_PET_SOURCE_SIZE;
		eyeAccessory.setAttribute('aria-hidden', 'true');
		eyeAccessoryContainer.appendChild(eyeAccessory);
		visual.appendChild(eyeAccessoryContainer);

		var speechBubbleContainer = document.createElement('div');
		speechBubbleContainer.className = 'chat-pet-speech-bubble hidden';
		var speechBubbleCanvas = document.createElement('canvas');
		speechBubbleCanvas.className = 'chat-pet-canvas chat-pet-speech-canvas';
		speechBubbleCanvas.width = CHAT_PET_SOURCE_SIZE;
		speechBubbleCanvas.height = CHAT_PET_SOURCE_SIZE;
		speechBubbleCanvas.setAttribute('aria-hidden', 'true');
		var speechBubbleImage = new Image();
		speechBubbleImage.className = 'chat-pet-spritesheet';
		speechBubbleImage.alt = '';
		speechBubbleImage.setAttribute('aria-hidden', 'true');
		speechBubbleContainer.appendChild(speechBubbleCanvas);
		speechBubbleContainer.appendChild(speechBubbleImage);
		visual.appendChild(speechBubbleContainer);

		// --- geometry helpers ------------------------------------------------
		function displaySize() { return CHAT_PET_SOURCE_SIZE / 2 * scale; }

		function overlayRect() { return overlay.getBoundingClientRect(); }

		function getHorizontalBounds(knownBounds) {
			var bounds = knownBounds || overlayRect();
			if (bounds.width <= 0) { return undefined; }
			return { minimumLeft: 0, maximumLeft: Math.max(0, bounds.width - displaySize()) };
		}

		function getMinimumTop() { return 0; }

		/**
		 * Host-relative Y of the code area's *visible* bottom edge. Measure it
		 * directly instead of summing borders: the host (`inset:0`) starts at
		 * the editor part's padding box — i.e. inside its top border — so the
		 * distance from the host top to the part's outer bottom edge is simply
		 * `partRect.bottom - hostRect.top`. This automatically accounts for the
		 * top+bottom card borders in modern UI and is a no-op in classic UI.
		 */
		function floorTop() {
			var part = ROOT.parentElement;
			var hostRect = overlayRect();
			if (part && hostRect.height > 0) {
				var floor = part.getBoundingClientRect().bottom - hostRect.top;
				if (Number.isFinite(floor) && floor > 0) { return floor; }
			}
			return hostRect.height;
		}

		function getMaximumTop() { return Math.max(0, floorTop() - displaySize()); }
		function getFloorTop() { return Math.max(0, floorTop() - displaySize()); }

		function getThrowGeometry(platformPetLeft) {
			var bounds = overlayRect();
			var display = displaySize();
			// Host-relative bottom of the editor area (the floor the pet stands on).
			var platformTop = floorTop();
			return {
				bounds: {
					minimumLeft: 0,
					maximumLeft: Math.max(0, bounds.width - display),
					minimumTop: 0,
				},
				displaySize: display,
				inputTop: platformTop,
				overlayLeft: bounds.left,
				overlayTop: bounds.top,
				platformLeft: 0,
				platformRight: bounds.width,
				platformTop: platformTop,
				floorTop: Math.max(0, platformTop - display),
			};
		}

		function getCurrentLeft() { return button.offsetLeft; }

		function setThrowPosition(left, top) {
			button.style.left = left + 'px';
			button.style.top = top + 'px';
			button.style.right = 'auto';
			button.style.bottom = 'auto';
			hasCustomPosition = true;
			updateBounceCounterPosition();
		}

		function getFallTarget() {
			var display = displaySize();
			var top = Math.max(0, floorTop() - display); // rest on bottom
			return { top: top, landsOnPlatform: true };
		}

		function getThrowSettleTarget() {
			var geometry = getThrowGeometry(getCurrentLeft());
			return { top: geometry.platformTop - geometry.displaySize, landsOnPlatform: true };
		}

		/* --- positioning ------------------------------------------------------ */
		function setHorizontalPosition(left, updateAnchor) {
			var bounds = getHorizontalBounds();
			if (!bounds) { return false; }
			var clampedLeft = getChatPetHorizontalPosition(left, bounds.minimumLeft, bounds.maximumLeft);
			button.style.left = clampedLeft + 'px';
			button.style.right = 'auto';
			baseLeft = clampedLeft;
			hasCustomPosition = true;
			if (updateAnchor) {
				horizontalAnchor = getChatPetHorizontalAnchor(clampedLeft, bounds.minimumLeft, bounds.maximumLeft);
				var relative = getChatPetRelativeHorizontalPosition(clampedLeft, bounds.minimumLeft, bounds.maximumLeft);
				if (relative !== undefined) { horizontalPosition = relative; storageSet('horizontalPosition', String(relative)); }
			}
			updateSpeechBubblePosition();
			return clampedLeft !== left;
		}

		function setDefaultHorizontalPosition() {
			var bounds = getHorizontalBounds();
			if (!bounds) { return; }
			var left = getChatPetDefaultHorizontalPosition(bounds.minimumLeft, bounds.maximumLeft);
			button.style.left = left + 'px';
			button.style.right = 'auto';
			baseLeft = left;
			hasCustomPosition = false;
			horizontalAnchor = undefined;
			updateSpeechBubblePosition();
		}

		function restoreHorizontalPosition() {
			var bounds = getHorizontalBounds();
			if (!bounds) { return; }
			var left = getChatPetRestoredHorizontalPosition(horizontalPosition, bounds.minimumLeft, bounds.maximumLeft);
			button.style.left = left + 'px';
			button.style.right = 'auto';
			baseLeft = left;
			hasCustomPosition = horizontalPosition !== undefined;
			horizontalAnchor = horizontalPosition === undefined ? undefined : getChatPetHorizontalAnchor(left, bounds.minimumLeft, bounds.maximumLeft);
			updateSpeechBubblePosition();
		}

		function updateRestingPosition() {
			if (isDragging) { return; }
			if (hasCustomPosition) {
				var bounds = getHorizontalBounds();
				if (!bounds) { return; }
				var left = horizontalAnchor ? getChatPetAnchoredHorizontalPosition(horizontalAnchor, bounds.minimumLeft, bounds.maximumLeft) : baseLeft;
				setHorizontalPosition(left, false);
			} else {
				setDefaultHorizontalPosition();
			}
			updateVerticalPosition();
		}

		function updateVerticalPosition() {
			// `button.style.top` is relative to the host (the overlay fills the host
			// via `inset: 0`). The resting top is the floor (host height plus any
			// modern-UI card border) minus the pet size. Do NOT subtract
			// `bounds.top` — that is a viewport offset and would leave the pet
			// floating above the bottom.
			var top = floorTop() - displaySize();
			button.style.top = top + 'px';
			button.style.bottom = 'auto';
		}

		function setScale(newScale) {
			scale = newScale;
			storageSet('scale', String(scale));
			var display = displaySize();
			button.style.width = display + 'px';
			button.style.height = display + 'px';
			visual.style.transform = 'scale(' + scale + ')';
			updateBounceCounterPosition();
			if (button.classList.contains('throwing')) { throwGeometryDirty = true; }
			if (!isDragging && !isAirborne()) { updateRestingPosition(); }
		}

		/* --- facing / gaze ---------------------------------------------------- */
		function setFacingDirection(direction) {
			var changed = button.getAttribute('data-facing') !== direction;
			facingController.setDirection(direction);
			button.setAttribute('data-facing', direction);
			if (changed) {
				if (activeSprite && activeSprite.redrawFrame) { activeSprite.redrawFrame(); }
				updateSpeechBubblePosition();
			}
		}

		function recordDirectionChange(direction) {
			if (transientState === 'dizzy') { return false; }
			if (!directionChangeController.record(direction, now())) { return false; }
			setFacingDirection(direction);
			showTransientState('dizzy', false);
			status('The VS Code pet got dizzy');
			return true;
		}

		function snapFacingToCursor() {
			if (!cursorPosition) { return; }
			var bounds = button.getBoundingClientRect();
			setFacingDirection(facingController.snapToCursor(cursorPosition[0], bounds.left + bounds.width / 2));
		}

		function updateGaze() {
			if (!cursorPosition) { return; }
			var bounds = button.getBoundingClientRect();
			var direction = facingController.update(cursorPosition[0], bounds.left + bounds.width / 2);
			if (button.getAttribute('data-facing') !== direction) {
				setFacingDirection(direction);
				recordDirectionChange(direction);
			}
			var gaze = getChatPetGazeDirection(cursorPosition[0], cursorPosition[1], bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
			for (var i = 0; i < pupils.length; i++) {
				pupils[i].style.transform = 'translate(' + (gaze[0] * 2) + 'px, ' + (gaze[1] * 2) + 'px)';
			}
			eyeAccessoryGazeOffset = [gaze[0] * 4, gaze[1] * 4];
			if (redrawEyeAccessory) { redrawEyeAccessory(); }
		}

		/* --- eyes -------------------------------------------------------------- */
		function updateEyes(state, frameIndex) {
			var tracksCursor = doesChatPetStateTrackCursor(state);
			var blinking = doesChatPetStateBlink(state, frameIndex);
			eyes.classList.toggle('tracking', tracksCursor);
			eyes.classList.toggle('blinking', blinking);
			blinkController.setEnabled(enabled && !motionReduced && !document.hidden && (tracksCursor || blinking));
			if (!tracksCursor && (eyeAccessoryGazeOffset[0] !== 0 || eyeAccessoryGazeOffset[1] !== 0)) {
				eyeAccessoryGazeOffset = [0, 0];
				if (redrawEyeAccessory) { redrawEyeAccessory(); }
			}
			if (blinking) {
				for (var i = 0; i < pupils.length; i++) { pupils[i].style.transform = ''; }
			}
		}

		function restartEyeAnimation() {
			eyes.classList.remove('animated');
			void eyes.getBoundingClientRect();
			if (!motionReduced) { eyes.classList.add('animated'); }
		}

		/* --- speech bubble ----------------------------------------------------- */
		var speechBubbleState;
		function updateSpeechBubble(state, restart) {
			updateSpeechBubblePosition();
			var visible = doesChatPetStateSpeak(state);
			var newState = visible ? state : undefined;
			var stateChanged = newState !== speechBubbleState;
			speechBubbleState = newState;
			speechBubbleContainer.classList.toggle('hidden', !visible);
			if (!visible) { speechAnimationId++; return; }
			var sources = buildSpeechSource(variant);
			var source = motionReduced ? sources.reducedMotion : sources.animated;
			if (speechBubbleImage.getAttribute('src') !== source.url) {
				speechAnimationId++;
				setImageSource(speechBubbleImage, source.url);
				return;
			}
			if ((restart || stateChanged) && speechBubbleImage.complete && speechBubbleImage.naturalWidth > 0) {
				speechAnimationId++;
				if (speechAnimationCancel) { speechAnimationCancel(); }
				speechAnimationCancel = startSpriteAnimation(source, { container: speechBubbleContainer, image: speechBubbleImage, canvas: speechBubbleCanvas }, { generation: speechAnimationId }, undefined, false, undefined, undefined, true);
			}
		}

		function updateSpeechBubblePosition() {
			var buttonBounds = button.getBoundingClientRect();
			var bounds = overlayRect();
			button.classList.toggle('speech-bubble-left', shouldPlaceChatPetSpeechBubbleLeft(renderedState, buttonBounds.right, bounds.right, scale));
			var wideSpriteOffset = getChatPetWideSpriteHorizontalOffset(renderedState, facingController.direction(), buttonBounds.left, buttonBounds.right, bounds.left, bounds.right, scale);
			var layers = [];
			if (activeSprite) { layers.push(activeSprite.container); }
			layers.push(eyes, eyeAccessoryContainer);
			setChatPetWideLayerOffset(wideSpriteOffset, layers);
		}

		/* --- image helpers ------------------------------------------------------ */
		function setImageSource(image, url) {
			image.removeAttribute('src');
			image.src = url;
		}

		function getAccessoryImageSource(accessory) {
			var url = ACCESSORY_ATLASES[accessory.atlasName];
			if (!url) { return undefined; }
			return { url: url, cellSize: 96, width: 384, height: 288 };
		}

		function getSelectedAccessorySource() {
			if (!selectedAccessory) { return undefined; }
			var accessory = getAccessory(selectedAccessory);
			return accessory ? getAccessoryImageSource(accessory) : undefined;
		}

		/* --- render state ------------------------------------------------------- */
		function renderState(state, restart, useStaticSprite) {
			if (state !== 'idle' || useStaticSprite) {
				facingController.setState(state, !!useStaticSprite);
			}
			var source = buildSpriteSource(variant, state);
			var selected = motionReduced || useStaticSprite ? source.reducedMotion : source.animated;
			if (!restart && activeSprite && activeSprite.image.getAttribute('src') === selected.url) {
				pendingRender = undefined;
				renderGeneration++;
				button.setAttribute('data-state', state);
				renderedState = state;
				setRenderedFacingState(state, !!useStaticSprite);
				updateEyes(state);
				updateSpeechBubble(state, restart);
				return;
			}

			var sprite = sprites[0] === activeSprite ? sprites[1] : sprites[0];
			if (!sprite) { return; }

			var accessorySource = getSelectedAccessorySource();
			var accessoryImage = accessorySource && !failedAccessorySources[accessorySource.url]
				? sprite.accessoryImages[0] : undefined;
			var generation = ++renderGeneration;
			pendingRender = {
				generation: generation,
				sprite: sprite,
				bodySource: selected,
				accessorySource: accessoryImage ? accessorySource : undefined,
				accessoryImage: accessoryImage,
				accessory: accessoryImage ? selectedAccessory : undefined,
				state: state,
				useStaticSprite: !!useStaticSprite,
			};
			setImageSource(sprite.image, selected.url);
			if (accessoryImage && accessorySource) { setImageSource(accessoryImage, accessorySource.url); }
		}

		function onBodyImageLoad(sprite) {
			if (!pendingRender || pendingRender.sprite !== sprite) { return; }
			tryCompletePendingRender();
		}

		function onBodyImageError(sprite) {
			if (!pendingRender || pendingRender.sprite !== sprite || sprite.image.getAttribute('src') !== pendingRender.bodySource.url) { return; }
			pendingRender = undefined;
		}

		function onAccessoryImageLoad(sprite, image) {
			if (pendingRender && pendingRender.sprite === sprite && pendingRender.accessoryImage === image) {
				tryCompletePendingRender();
			}
		}

		function onAccessoryImageError(sprite, image) {
			if (pendingRender && pendingRender.sprite === sprite && pendingRender.accessoryImage === image && pendingRender.accessorySource) {
				failedAccessorySources[pendingRender.accessorySource.url] = true;
				pendingRender = { generation: pendingRender.generation, sprite: pendingRender.sprite, bodySource: pendingRender.bodySource, accessorySource: undefined, accessoryImage: undefined, accessory: undefined, state: pendingRender.state, useStaticSprite: pendingRender.useStaticSprite };
				tryCompletePendingRender();
			}
		}

		function tryCompletePendingRender() {
			var pr = pendingRender;
			if (!pr || pr.generation !== renderGeneration || pr.sprite.image.getAttribute('src') !== pr.bodySource.url || !pr.sprite.image.complete || pr.sprite.image.naturalWidth === 0) {
				return;
			}
			var frameHeight = pr.bodySource.frameHeight || CHAT_PET_SOURCE_SIZE;
			var frameCount = Math.max(1, pr.bodySource.frameDurations.length);
			if (pr.sprite.image.naturalWidth !== pr.bodySource.frameWidth * frameCount || pr.sprite.image.naturalHeight !== frameHeight) {
				pendingRender = undefined;
				return;
			}
			if (pr.accessorySource && pr.accessoryImage) {
				if (pr.accessoryImage.getAttribute('src') !== pr.accessorySource.url || !pr.accessoryImage.complete || pr.accessoryImage.naturalWidth === 0) {
					return;
				}
				if (pr.accessoryImage.naturalWidth !== pr.accessorySource.width || pr.accessoryImage.naturalHeight !== pr.accessorySource.height) {
					failedAccessorySources[pr.accessorySource.url] = true;
					pendingRender = { generation: pr.generation, sprite: pr.sprite, bodySource: pr.bodySource, accessorySource: undefined, accessoryImage: undefined, accessory: undefined, state: pr.state, useStaticSprite: pr.useStaticSprite };
					tryCompletePendingRender();
					return;
				}
			}

			spriteAnimationId++;
			if (bodyAnimationCancel) { bodyAnimationCancel(); }
			var previousSprite = activeSprite;
			if (previousSprite) { previousSprite.container.classList.add('hidden'); }
			pr.sprite.container.classList.remove('hidden');
			pr.sprite.activeAccessory = pr.accessory;
			pr.sprite.activeAccessoryImage = pr.accessoryImage;
			activeSprite = pr.sprite;
			activeSource = pr.bodySource;
			accessoryGeneration++;
			var state = pr.state;
			bodyAnimationCancel = startSpriteAnimation(pr.bodySource, pr.sprite, { generation: spriteAnimationId }, function () { onSpriteAnimationComplete(pr.sprite, state); }, false, function (frameIndex) {
				if (pr.sprite === activeSprite) { updateEyes(state, frameIndex); }
			}, state, false);
			button.setAttribute('data-state', state);
			renderedState = state;
			setRenderedFacingState(state, isDragging);
			updateEyes(state);
			updateSpeechBubble(state, true);
			pendingRender = undefined;
			restartEyeAnimation();
		}

		function onSpriteAnimationComplete(sprite, state) {
			if (sprite !== activeSprite) { return; }
			if (state === 'jump' && hopController) { hopController.onAnimationComplete(); }
			// Non-looping transient states self-dismiss via the transient scheduler.
		}

		function startSpriteAnimation(source, sprite, animation, onComplete, reverse, onFrame, state, isSpeech) {
			var frameDurations = source.frameDurations;
			var image = sprite.image;
			var canvas = sprite.canvas;
			var display = isSpeech ? 72 : CHAT_PET_DISPLAY_SIZE;
			var frameHeight = source.frameHeight || CHAT_PET_SOURCE_SIZE;
			var displayScale = display / CHAT_PET_SOURCE_SIZE;
			var displayWidth = source.frameWidth * displayScale;
			var displayHeight = frameHeight * displayScale;
			sprite.container.style.width = displayWidth + 'px';
			sprite.container.style.height = displayHeight + 'px';
			canvas.width = source.frameWidth;
			canvas.height = frameHeight;
			canvas.style.width = displayWidth + 'px';
			canvas.style.height = displayHeight + 'px';
			var context = canvas.getContext('2d');
			if (!context) { return; }
			context.imageSmoothingEnabled = false;
			var renderedFrameIndex = 0;
			var spriteKey = source.url;

			var drawFrame = function (frameIndex) {
				renderedFrameIndex = frameIndex;
				if (state) {
					var accessory = sprite.activeAccessory ? getAccessory(sprite.activeAccessory) : undefined;
					drawChatPetComposite(
						context,
						image,
						sprite.activeAccessoryImage,
						frameIndex,
						source.accessoryRigFrame !== undefined ? source.accessoryRigFrame : frameIndex,
						source.frameWidth,
						frameHeight,
						facingController.direction(),
						state,
						source.fixedOrientationDecorations,
						false,
						!accessory || accessory.eyeAccessoryMirrorsWithFacing !== false,
						!!(accessory && accessory.coversAntennae),
						color,
						spriteKey,
					);
					drawEyeAccessoryLayer(sprite.activeAccessory, sprite.activeAccessoryImage, source, state, source.accessoryRigFrame !== undefined ? source.accessoryRigFrame : frameIndex);
				} else {
					context.clearRect(0, 0, source.frameWidth, frameHeight);
					var colored = getChatPetColoredSprite(image, color, spriteKey);
					context.drawImage(colored, frameIndex * source.frameWidth, 0, source.frameWidth, frameHeight, 0, 0, source.frameWidth, frameHeight);
				}
				if (sprite === activeSprite) { activeFrameIndex = frameIndex; }
				if (onFrame) { onFrame(frameIndex); }
			};

			sprite.redrawFrame = function () {
				if (image.complete && image.naturalWidth > 0 && image.getAttribute('src') === source.url) {
					drawFrame(renderedFrameIndex);
				}
			};
			if (sprite === activeSprite) {
				eyes.style.color = getChatPetEyeColor(color);
				redrawEyeAccessory = state
					? function () { drawEyeAccessoryLayer(sprite.activeAccessory, sprite.activeAccessoryImage, source, state, source.accessoryRigFrame !== undefined ? source.accessoryRigFrame : activeFrameIndex); }
					: undefined;
			}

			var initialFrameIndex = reverse && frameDurations.length > 0 ? frameDurations.length - 1 : 0;
			drawFrame(initialFrameIndex);
			if (frameDurations.length < 2) { return undefined; }

			var startTime = now();
			var currentFrame = 0;
			var frameTimer = null;
			var cancelled = false;
			var visListener = null;
			var clearFrameTimer = function () {
				if (frameTimer !== null) {
					clearTimeout(frameTimer);
					frameTimer = null;
				}
			};
			var cancel = function () {
				cancelled = true;
				clearFrameTimer();
				if (visListener) {
					document.removeEventListener('visibilitychange', visListener);
					visListener = null;
				}
			};
			var scheduleFrame = function (delay) {
				clearFrameTimer();
				if (!document.hidden && !cancelled) {
					frameTimer = setTimeout(updateFrame, Math.max(1, Math.ceil(delay)));
				}
			};
			var updateFrame = function () {
				if (cancelled) { return; }
				frameTimer = null;
				var frame = getChatPetAnimationFrame(frameDurations, now() - startTime, source.iterations, reverse);
				if (frame.complete) {
					drawFrame(frame.frameIndex);
					cancel();
					if (onComplete) { onComplete(); }
					return;
				}
				if (frame.frameIndex !== currentFrame) {
					currentFrame = frame.frameIndex;
					drawFrame(frame.frameIndex);
				}
				scheduleFrame(frame.nextFrameDelay);
			};
			visListener = function onVis() {
				if (cancelled) { return; }
				clearFrameTimer();
				if (!document.hidden) { updateFrame(); }
			};
			document.addEventListener('visibilitychange', visListener);
			scheduleFrame(frameDurations[initialFrameIndex]);
			return cancel;
		}

		function drawEyeAccessoryLayer(accessoryId, accessoryImage, source, state, rigFrameIndex) {
			var frameHeight = source.frameHeight || CHAT_PET_SOURCE_SIZE;
			var rigFrame = getChatPetAccessoryRigFrame(state, rigFrameIndex);
			var visible = accessoryImage !== undefined && rigFrame.rightEye !== undefined;
			if (visible !== eyeAccessoryVisible) {
				eyeAccessoryVisible = visible;
				eyeAccessoryContainer.classList.toggle('hidden', !visible);
			}
			if (!visible || !accessoryImage) { return; }

			var accessory = accessoryId ? getAccessory(accessoryId) : undefined;
			var mirrorsWithFacing = !accessory || accessory.eyeAccessoryMirrorsWithFacing !== false;
			var fixedOrientation = !mirrorsWithFacing;
			if (fixedOrientation !== eyeAccessoryFixedOrientation) {
				eyeAccessoryFixedOrientation = fixedOrientation;
				eyeAccessoryContainer.classList.toggle('fixed-orientation', fixedOrientation);
			}

			var displayScale = CHAT_PET_DISPLAY_SIZE / CHAT_PET_SOURCE_SIZE;
			eyeAccessory.width = source.frameWidth;
			eyeAccessory.height = frameHeight;
			eyeAccessoryContainer.style.width = (source.frameWidth * displayScale) + 'px';
			eyeAccessoryContainer.style.height = (frameHeight * displayScale) + 'px';
			eyeAccessory.style.width = (source.frameWidth * displayScale) + 'px';
			eyeAccessory.style.height = (frameHeight * displayScale) + 'px';

			var context = eyeAccessory.getContext('2d');
			if (!context) { return; }
			context.imageSmoothingEnabled = false;
			var facingDirection = source.fixedOrientationDecorations || !mirrorsWithFacing ? facingController.direction() : 'right';
			drawChatPetEyeAccessory(context, accessoryImage, state, rigFrameIndex, facingDirection, mirrorsWithFacing, mirrorsWithFacing ? undefined : eyeAccessoryGazeOffset);
		}

		function setRenderedFacingState(state, dragging) {
			facingController.setState(state, dragging);
			if (!dragging && doesChatPetStateTrackCursor(state)) { updateGaze(); }
		}

		/* --- transient states ---------------------------------------------------- */
		function showTransientState(state, snap) {
			if (snap !== false) { snapFacingToCursor(); }
			wake();
			var rendered = state === 'yapping' && motionReduced ? 'yappingMouthOpen' : state;
			transientState = rendered;
			if (rendered === 'yappingMouthOpen' || rendered === 'yapping') {
				clearTimeout(transientTimer);
			} else {
				clearTimeout(transientTimer);
				transientTimer = setTimeout(function () { transientState = undefined; renderLoop(); }, getTransientStateDuration(rendered));
			}
			if (!isDragging && transientState === rendered) { renderState(rendered, true); }
		}

		/* --- wake / idle --------------------------------------------------------- */
		function wake() {
			dismissBounceResult();
			var wasSleeping = idleExpired || renderedState === 'sleep';
			idleExpired = false;
			scheduleIdle();
			if (wasSleeping) { beginWakeAnimation(); }
		}

		function beginWakeAnimation() {
			if (motionReduced) { return; }
			transientState = 'waking';
			clearTimeout(transientTimer);
			transientTimer = setTimeout(function () { transientState = undefined; renderLoop(); }, WAKE_STATE_DURATION);
			return 'waking';
		}

		function scheduleIdle() {
			clearTimeout(idleTimer);
			idleTimer = setTimeout(function () {
				idleExpired = true;
				renderLoop();
			}, IDLE_SLEEP_DELAY);
		}

		/* --- the render loop ------------------------------------------------------ */
		function renderLoop() {
			var baseState = getChatPetBaseState(idleExpired, typingActive);
			var rendered = getChatPetRenderedState(baseState, transientState, isDragging);
			if (rendered !== 'idle' && rendered !== 'splat') { dismissBounceResult(); }
			renderState(rendered, false, isDragging);
		}

		/**
		 * Enters/exits the "typing" base state while the user is coding. While
		 * typing, the pet types along; the state clears a short while after the
		 * last keystroke.
		 */
		function setTypingActive(on) {
			clearTimeout(typingTimer);
			if (on) {
				if (!typingActive) {
					typingActive = true;
					wake(); // cancels sleep and reschedules the idle timer
					renderLoop();
				}
				typingTimer = setTimeout(function () { setTypingActive(false); }, 900);
			} else if (typingActive) {
				typingActive = false;
				renderLoop();
			}
		}

		function isTypingKey(event) {
			if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) { return false; }
			if (!event.key || event.key.length !== 1) { return false; }
			var target = event.target;
			if (!target || typeof target.closest !== 'function') { return false; }
			// Only count keystrokes inside an editor input area within the editor
			// part (not the chat input, terminal, command palette, etc.).
			var inputArea = target.closest('.inputarea, textarea, [contenteditable="true"], .monaco-editor');
			if (!inputArea) { return false; }
			var editorPart = document.getElementById('workbench.parts.editor');
			return !editorPart || editorPart.contains(target);
		}

		/* --- interactions ---------------------------------------------------------- */
		function isAirborne() {
			return button.classList.contains('falling') || button.classList.contains('throwing');
		}

		var dragSamples = [];

		function startDrag(event) {
			if (!enabled || isDragging || isAirborne() || onTheRun || event.button !== 0) { return; }
			wake();
			event.preventDefault();
			event.stopPropagation();
			button.focus();
			var startX = event.clientX;
			var startY = event.clientY;
			dragSamples = [{ x: startX, y: startY, time: now() }];
			var buttonBounds = button.getBoundingClientRect();
			var bounds = overlayRect();
			var startLeft = buttonBounds.left - bounds.left;
			var startTop = buttonBounds.top - bounds.top;
			var didDrag = false;

			function onMove(moveEvent) {
				var deltaX = moveEvent.clientX - startX;
				var deltaY = moveEvent.clientY - startY;
				var sampleTime = now();
				dragSamples.push({ x: moveEvent.clientX, y: moveEvent.clientY, time: sampleTime });
				while (dragSamples.length > 2 && sampleTime - dragSamples[0].time > THROW_VELOCITY_SAMPLE_DURATION) {
					dragSamples.shift();
				}
				if (!didDrag && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) { return; }
				if (!didDrag) {
					didDrag = true;
					button.classList.remove('entering');
					button.classList.add('dragging');
					spriteAnimationId++;
					setDragPosition(startLeft, startTop);
					isDragging = true;
					renderState('idle', false, true);
				}
				moveEvent.preventDefault();
				moveEvent.stopPropagation();
				trackCursor(moveEvent);
				setDragPosition(startLeft + deltaX, startTop + deltaY);
			}

			function onUp(upEvent) {
				document.removeEventListener('pointermove', onMove);
				document.removeEventListener('pointerup', onUp);
				document.removeEventListener('pointercancel', onUp);
				if (upEvent instanceof PointerEvent) { trackCursor(upEvent); }
				button.classList.remove('dragging', 'resisting', 'soft-resisting');
				if (didDrag) {
					suppressNextPointerClick = true;
					clearTimeout(clickSuppressionTimer);
					clickSuppressionTimer = setTimeout(function () { suppressNextPointerClick = false; }, 0);
					isDragging = false;
					var throwVelocity = getChatPetThrowVelocity(dragSamples, now());
					if (!motionReduced && throwVelocity) {
						beginThrow(throwVelocity, false, MOUSE_BOUNCE_RELEASE_GRACE_DURATION);
					} else {
						beginFall(MOUSE_BOUNCE_RELEASE_GRACE_DURATION);
					}
				}
			}

			document.addEventListener('pointermove', onMove);
			document.addEventListener('pointerup', onUp);
			document.addEventListener('pointercancel', onUp);
		}

		function setDragPosition(left, top) {
			var bounds = overlayRect();
			var movementBounds = bounds;
			var minimumLeft = movementBounds.left - bounds.left;
			var maximumLeft = movementBounds.right - bounds.left - button.offsetWidth;
			var minimumTop = movementBounds.top - bounds.top;
			var maximumTop = movementBounds.bottom - bounds.top - button.offsetHeight;
			var pos = getChatPetDragPosition(left, top, minimumLeft, maximumLeft, minimumTop, maximumTop);
			button.style.left = pos[0] + 'px';
			button.style.top = pos[1] + 'px';
			button.style.right = 'auto';
			button.style.bottom = 'auto';
			hasCustomPosition = true;
			updateSpeechBubblePosition();
			if (button.classList.contains('dragging')) {
				var landsOnPlatform = getFallTarget().landsOnPlatform;
				button.classList.toggle('soft-resisting', landsOnPlatform);
				button.classList.toggle('resisting', !landsOnPlatform);
			}
		}

		/* --- fall / throw ----------------------------------------------------------- */
		function beginFall(mouseBounceDelay) {
			var top = parseFloat(button.style.top) || getMaximumTop();
			var target = getFallTarget();
			resetBounceCount();
			cursorSamples = [];
			mouseBounceAvailableAt = now() + (mouseBounceDelay || 0);
			clearTimeout(transientTimer);
			throwAnimationId++;
			throwBounceHandler = undefined;
			throwWallImpact = undefined;
			throwGeometryDirty = false;
			button.style.transform = '';
			button.classList.remove('bounce-impact', 'throwing');
			button.classList.remove('resisting', 'soft-resisting');
			fallLandsOnPlatform = target.landsOnPlatform;
			transientState = 'falling';
			isDragging = false;
			renderState('falling', true);
			var bounds = button.getBoundingClientRect();
			cursorContactingPet = cursorPosition !== undefined && isChatPetMouseContact(cursorPosition[0], cursorPosition[1], bounds);
			button.style.transitionDuration = getChatPetFallDuration(target.top - top) + 'ms';
			void button.getBoundingClientRect();
			button.classList.add('falling');
			button.style.top = target.top + 'px';
			if (motionReduced || Math.abs(target.top - top) <= POSITION_EPSILON) { finishFall(); }
		}

		function finishFall() {
			if (!button.classList.contains('falling')) { return; }
			button.classList.remove('falling');
			button.style.transitionDuration = '';
			completeFall(true);
		}

		function beginThrow(velocity, preserveBounceCount, mouseBounceDelay, startWithBounceImpact) {
			var geometry = getThrowGeometry();
			var buttonBounds = button.getBoundingClientRect();
			var motion = {
				left: buttonBounds.left - geometry.overlayLeft,
				top: buttonBounds.top - geometry.overlayTop,
				x: velocity.x,
				y: velocity.y,
			};
			var rotation = 0;
			var wallImpact;
			var bounceImpactEndsAt;
			var startTime = now();
			var lastFrameTime = startTime;

			if (!preserveBounceCount) { resetBounceCount(); }
			cursorSamples = [];
			mouseBounceAvailableAt = startTime + (mouseBounceDelay || 0);
			button.classList.remove('falling');
			button.style.transitionDuration = '';
			mouseBounceArmed = false;
			cursorContactingPet = cursorPosition !== undefined && isChatPetMouseContact(cursorPosition[0], cursorPosition[1], buttonBounds);
			if (velocity.x !== 0) { setFacingDirection(velocity.x < 0 ? 'left' : 'right'); }
			clearTimeout(transientTimer);
			throwWallImpact = undefined;
			throwGeometryDirty = false;
			fallLandsOnPlatform = false;
			setThrowPosition(motion.left, motion.top);
			transientState = 'falling';
			isDragging = false;
			renderState('falling', true);
			button.classList.add('throwing');
			var token = ++throwAnimationId;

			var beginBounceImpact = function () {
				var t = now();
				startTime = t;
				lastFrameTime = t;
				bounceImpactEndsAt = t + WALL_IMPACT_DURATION;
				rotation = 0;
				button.style.transform = '';
				button.classList.add('bounce-impact');
				transientState = 'wallImpact';
			};
			throwBounceHandler = function (pointerX, pointerVelocity, requireDescending, exactCollisionMotion) {
				var t = now();
				var collisionMotion = exactCollisionMotion || advanceChatPetThrow(motion, Math.min(THROW_MAX_FRAME_DURATION, Math.max(0, t - lastFrameTime)), geometry.bounds);
				if (!button.classList.contains('throwing') || wallImpact || bounceImpactEndsAt !== undefined || (requireDescending && !isChatPetMouseBounceEligible(collisionMotion.y))) {
					return false;
				}
				var bounds = button.getBoundingClientRect();
				var bounceVelocity = getChatPetMouseBounceVelocity(collisionMotion, pointerVelocity, pointerX, bounds.left, bounds.width);
				motion = { left: collisionMotion.left, top: collisionMotion.top, x: bounceVelocity.x, y: bounceVelocity.y };
				throwWallImpact = undefined;
				beginBounceImpact();
				return true;
			};
			if (startWithBounceImpact) { beginBounceImpact(); }

			function updateFrame() {
				if (throwAnimationId !== token) { return; }
				var t = now();
				if (throwGeometryDirty) {
					geometry = getThrowGeometry();
					throwGeometryDirty = false;
					motion = { left: motion.left, top: motion.top, x: motion.x, y: motion.y };
					motion.left = getChatPetHorizontalPosition(motion.left, geometry.bounds.minimumLeft, geometry.bounds.maximumLeft);
					setThrowPosition(motion.left, motion.top);
				}
				if (shouldSettleChatPetThrow(startTime, t, motion.top, motion.y, geometry.floorTop)) {
					finishThrow(true);
					return;
				}
				if (bounceImpactEndsAt !== undefined) {
					if (t < bounceImpactEndsAt) { requestAnimationFrame(updateFrame); return; }
					bounceImpactEndsAt = undefined;
					lastFrameTime = t;
					button.classList.remove('bounce-impact');
					transientState = 'falling';
					requestAnimationFrame(updateFrame);
					return;
				}
				if (wallImpact) {
					if (t < wallImpact.endsAt) { requestAnimationFrame(updateFrame); return; }
					var rebound = getChatPetWallReboundVelocity(motion);
					motion = { left: motion.left, top: motion.top, x: rebound.x, y: rebound.y };
					rotation = wallImpact.wall === 'left' ? -90 : 90;
					button.style.transform = 'rotate(' + rotation + 'deg)';
					wallImpact = undefined;
					lastFrameTime = t;
					transientState = 'falling';
					requestAnimationFrame(updateFrame);
					return;
				}

				var elapsed = Math.min(THROW_MAX_FRAME_DURATION, Math.max(0, t - lastFrameTime));
				lastFrameTime = t;
				var previousMotion = motion;
				var step = advanceChatPetThrow(previousMotion, elapsed, geometry.bounds);
				var platformTop = geometry.platformTop;
				var landing = getChatPetThrowLanding(previousMotion.left, previousMotion.top, step.left, step.top, geometry.displaySize, geometry.displaySize, geometry.platformLeft, geometry.platformRight, platformTop, geometry.floorTop);
				var landingTime = landing && step.top !== previousMotion.top ? (landing.top - previousMotion.top) / (step.top - previousMotion.top) : undefined;
				var cursorPos = cursorPosition;
				var mouseCollisionTime = (t >= mouseBounceAvailableAt) && mouseBounceArmed && !cursorContactingPet && cursorPos
					? getChatPetMouseCollisionTime(geometry.overlayLeft + previousMotion.left, geometry.overlayTop + previousMotion.top, geometry.overlayLeft + step.left, geometry.overlayTop + step.top, geometry.displaySize, geometry.displaySize, cursorPos[0], cursorPos[1])
					: undefined;
				if (cursorPos && mouseCollisionTime !== undefined && (landingTime === undefined || mouseCollisionTime < landingTime)) {
					motion = advanceChatPetThrow(previousMotion, elapsed * mouseCollisionTime, geometry.bounds);
					rotation = getChatPetThrowRotation(rotation, motion.left - previousMotion.left, motion.y, elapsed * mouseCollisionTime);
					setThrowPosition(motion.left, motion.top);
					if (isChatPetMouseBounceEligible(motion.y) && bounceAirbornePet(cursorPos[0], getCursorVelocity(t), true, motion)) {
						cursorContactingPet = true;
						requestAnimationFrame(updateFrame);
						return;
					}
				}
				motion = step;
				rotation = getChatPetThrowRotation(rotation, motion.left - previousMotion.left, motion.y, elapsed);
				setThrowPosition(motion.left, motion.top);
				if (motion.y >= 0 && landing) {
					motion = { left: landing.left, top: landing.top, x: motion.x, y: motion.y };
					setThrowPosition(motion.left, motion.top);
					finishThrow(true, landing);
					return;
				}
				if (step.wall) {
					throwWallImpact = step.wall;
					wallImpact = { wall: step.wall, endsAt: t + WALL_IMPACT_DURATION };
					setFacingDirection(step.wall);
					rotation = step.wall === 'left' ? -90 : 90;
					button.style.transform = 'rotate(' + rotation + 'deg)';
					transientState = 'wallImpact';
					requestAnimationFrame(updateFrame);
					return;
				}
				button.style.transform = 'rotate(' + rotation + 'deg)';
				requestAnimationFrame(updateFrame);
			}
			requestAnimationFrame(updateFrame);
		}

		function finishThrow(announce, target) {
			if (!button.classList.contains('throwing')) { return; }
			var resolvedTarget = target || getThrowSettleTarget();
			throwBounceHandler = undefined;
			throwWallImpact = undefined;
			throwGeometryDirty = false;
			throwAnimationId++;
			button.classList.remove('bounce-impact');
			button.style.transform = '';
			button.style.top = resolvedTarget.top + 'px';
			void button.getBoundingClientRect();
			button.classList.remove('throwing');
			fallLandsOnPlatform = resolvedTarget.landsOnPlatform;
			completeFall(!!announce);
		}

		function completeFall(announce) {
			// In the editor overlay the pet always lands on the bottom surface.
			var left = getCurrentLeft();
			if (hasCustomPosition) { setHorizontalPosition(left, false); }
			else { setDefaultHorizontalPosition(); }
			updateVerticalPosition();
			updateBounceCounterPosition();
			if (announce) {
				showTransientState('splat');
				if (bounceCount >= CONFETTI_SCORE) {
					status('The VS Code pet landed with a ' + bounceCount + '-bounce streak');
				} else {
					status('The VS Code pet landed');
				}
			}
			showBounceResult();
			showBounceConfetti();
		}

		/* --- mouse bounce -------------------------------------------------------- */
		function getCursorVelocity(t) {
			return getChatPetThrowVelocity(cursorSamples, t) || { x: 0, y: 0 };
		}

		function bounceAirbornePet(pointerX, pointerVelocity, requireDescending, collisionMotion) {
			if (!enabled || motionReduced) { return false; }
			var bounced = false;
			if (button.classList.contains('throwing')) {
				bounced = throwBounceHandler ? throwBounceHandler(pointerX, pointerVelocity, requireDescending, collisionMotion) : false;
			} else if (button.classList.contains('falling')) {
				var bounds = button.getBoundingClientRect();
				var velocity = getChatPetMouseBounceVelocity({ x: 0, y: 0 }, pointerVelocity, pointerX, bounds.left, bounds.width);
				beginThrow(velocity, true, 0, true);
				bounced = true;
			}
			if (bounced) {
				clearTimeout(bounceResultTimer);
				mouseBounceArmed = false;
				bounceResultVisible = false;
				bounceCount++;
				bounceCounter.textContent = String(bounceCount);
				bounceCounter.classList.remove('hidden');
				updateBounceCounterPosition();
				status('VS Code pet bounce count: ' + bounceCount);
			}
			return bounced;
		}

		function tryMouseBounce(t, previousCursorPosition) {
			if (!enabled || motionReduced || !isAirborne() || !cursorPosition) {
				cursorContactingPet = false;
				return false;
			}
			if (t < mouseBounceAvailableAt) {
				var bounds = button.getBoundingClientRect();
				cursorContactingPet = isChatPetMouseContact(cursorPosition[0], cursorPosition[1], bounds);
				mouseBounceArmed = false;
				return false;
			}
			var bounds = button.getBoundingClientRect();
			var pointerX = cursorPosition[0];
			var currentlyContacting = isChatPetMouseContact(pointerX, cursorPosition[1], bounds);
			if (cursorContactingPet) {
				cursorContactingPet = currentlyContacting;
				mouseBounceArmed = !currentlyContacting;
				return false;
			}
			var contacting = currentlyContacting;
			if (!contacting && previousCursorPosition) {
				var collisionTime = getChatPetMouseCollisionTime(
					bounds.left - previousCursorPosition[0], bounds.top - previousCursorPosition[1],
					bounds.left - cursorPosition[0], bounds.top - cursorPosition[1],
					bounds.width, bounds.height, 0, 0,
				);
				if (collisionTime !== undefined) {
					pointerX = previousCursorPosition[0] + (cursorPosition[0] - previousCursorPosition[0]) * collisionTime;
					contacting = true;
				}
			}
			if (!contacting) {
				cursorContactingPet = false;
				return false;
			}
			var bounced = bounceAirbornePet(pointerX, getCursorVelocity(t), true);
			cursorContactingPet = bounced;
			return bounced;
		}

		function trackCursor(event) {
			var t = now();
			var previousCursorPosition = cursorPosition;
			cursorPosition = [event.clientX, event.clientY];
			mouseBounceArmed = t >= mouseBounceAvailableAt;
			cursorSamples.push({ x: event.clientX, y: event.clientY, time: t });
			while (cursorSamples.length > 2 && (cursorSamples.length > POINTER_VELOCITY_SAMPLE_LIMIT || t - cursorSamples[0].time > THROW_VELOCITY_SAMPLE_DURATION)) {
				cursorSamples.shift();
			}
			tryMouseBounce(t, previousCursorPosition);
		}

		/* --- bounce counter / confetti ------------------------------------------- */
		function updateBounceCounterPosition() {
			if (bounceCount === 0) { return; }
			var left = parseFloat(button.style.left);
			var top = parseFloat(button.style.top);
			if (!Number.isFinite(left) || !Number.isFinite(top)) { return; }
			bounceCounter.style.left = (left + displaySize()) + 'px';
			bounceCounter.style.top = top + 'px';
		}

		function showBounceConfetti() {
			if (motionReduced || bounceCount < CONFETTI_SCORE) { return; }
			var bounds = overlayRect();
			var petBounds = button.getBoundingClientRect();
			confettiAnchor.style.left = (petBounds.left - bounds.left) + 'px';
			confettiAnchor.style.top = (petBounds.top - bounds.top) + 'px';
			confettiAnchor.style.width = petBounds.width + 'px';
			confettiAnchor.style.height = petBounds.height + 'px';
			triggerConfetti(confettiAnchor);
		}

		function resetBounceCount() {
			clearTimeout(bounceResultTimer);
			bounceCount = 0;
			bounceResultVisible = false;
			cursorContactingPet = false;
			mouseBounceArmed = false;
			mouseBounceAvailableAt = 0;
			bounceCounter.textContent = '';
			bounceCounter.classList.add('hidden');
		}

		function showBounceResult() {
			cursorContactingPet = false;
			mouseBounceArmed = false;
			mouseBounceAvailableAt = 0;
			bounceResultVisible = bounceCount > 0;
			if (bounceResultVisible) {
				updateBounceCounterPosition();
				clearTimeout(bounceResultTimer);
				bounceResultTimer = setTimeout(resetBounceCount, BOUNCE_RESULT_DURATION);
			}
		}

		function dismissBounceResult() {
			if (bounceResultVisible) { resetBounceCount(); }
		}

		/* --- accessory switching ---------------------------------------------------- */
		function switchAccessory(accessory) {
			selectedAccessory = accessory;
			storageSet('accessory', accessory || '');
			// Simplest correct approach: re-render the current state so the
			// accessory is picked up by the composite renderer.
			if (activeSprite) {
				activeSprite.activeAccessory = accessory;
				var source = getSelectedAccessorySource();
				if (!source) {
					activeSprite.activeAccessoryImage = undefined;
					if (activeSprite.redrawFrame) { activeSprite.redrawFrame(); }
					return;
				}
				if (failedAccessorySources[source.url]) {
					activeSprite.activeAccessoryImage = undefined;
					if (activeSprite.redrawFrame) { activeSprite.redrawFrame(); }
					return;
				}
				var image = activeSprite.accessoryImages[0];
				activeSprite.activeAccessoryImage = image;
				image.addEventListener('load', function once() {
					if (activeSprite.activeAccessoryImage === image) {
						image.removeEventListener('load', once);
						if (activeSprite.redrawFrame) { activeSprite.redrawFrame(); }
					}
				});
				image.addEventListener('error', function onErr() {
					failedAccessorySources[source.url] = true;
					activeSprite.activeAccessoryImage = undefined;
					if (activeSprite.redrawFrame) { activeSprite.redrawFrame(); }
				});
				setImageSource(image, source.url);
			}
		}

		/* --- click interaction ------------------------------------------------------ */
		function onButtonClick(event) {
			event.preventDefault();
			event.stopPropagation();
			if (isAirborne()) { return; }
			if (suppressNextPointerClick) {
				suppressNextPointerClick = false;
				clearTimeout(clickSuppressionTimer);
				return;
			}
			if (onTheRun) {
				cursorRun = false;
				setOnTheRun(false);
				return;
			}
			var wasSleeping = idleExpired || renderedState === 'sleep';
			if (wasSleeping) { wake(); }
			if (wasSleeping || transientState === 'waking') {
				status('The VS Code pet woke up');
				return;
			}
			var interaction = getChatPetClickInteraction(Math.random(), lastClickInteraction);
			lastClickInteraction = interaction;
			showTransientState(interaction);
			var messages = {
				buttonPress: 'The VS Code pet pressed its button',
				complete: 'The VS Code pet did a rare spin',
				love: 'The VS Code pet feels loved',
				cool: 'The VS Code pet put on sunglasses',
				yapping: 'The VS Code pet is yapping',
				sing: 'The VS Code pet is singing',
				speechless: 'The VS Code pet is speechless',
				worry: 'The VS Code pet is worried',
			};
			status(messages[interaction] || '');
		}

		/* --- on the run ------------------------------------------------------------- */
		function setOnTheRun(value) {
			onTheRun = value;
			button.classList.toggle('on-the-run', value);
			if (value) {
				transientState = undefined;
				clearTimeout(transientTimer);
				renderLoop();
			}
		}

		/* --- context menu (native VS Code menu via the overlay bridge) ------------ */
		function runMenuAction(id) {
			if (id === 'onTheRun') {
				setOnTheRun(true);
				status('The VS Code pet went on the run');
			} else if (id === 'grow') {
				setScale(getChatPetScale(scale, CHAT_PET_SCALE_STEP));
				status('VS Code pet size: ' + Math.round(scale * 100) + ' percent');
			} else if (id === 'shrink') {
				setScale(getChatPetScale(scale, -CHAT_PET_SCALE_STEP));
				status('VS Code pet size: ' + Math.round(scale * 100) + ' percent');
			} else if (id === 'resetSize') {
				setScale(CHAT_PET_DEFAULT_SCALE);
				status('VS Code pet size: 100 percent');
			} else if (id.slice(0, 10) === 'accessory:') {
				var accId = id.slice(10);
				switchAccessory(accId === 'none' ? undefined : accId);
			} else if (id.slice(0, 6) === 'color:') {
				setColor(id.slice(6));
			}
		}

		function buildMenuItems() {
			var items = [];
			items.push({ type: 'action', id: 'onTheRun', label: 'Go on the Run', enabled: true });
			items.push({ type: 'separator' });
			items.push({ type: 'action', id: 'grow', label: 'Grow', enabled: true });
			items.push({ type: 'action', id: 'shrink', label: 'Shrink', enabled: scale > CHAT_PET_MIN_SCALE });
			items.push({ type: 'action', id: 'resetSize', label: 'Reset Size', enabled: scale !== CHAT_PET_DEFAULT_SCALE });
			items.push({ type: 'separator' });
			var accItems = [];
			for (var ai = 0; ai < accessoryCatalog.length; ai++) {
				var acc = accessoryCatalog[ai];
				accItems.push({ type: 'action', id: 'accessory:' + acc.id, label: acc.label, enabled: true, checked: selectedAccessory === acc.id });
			}
			accItems.push({ type: 'action', id: 'accessory:none', label: 'None', enabled: true, checked: !selectedAccessory });
			items.push({ type: 'submenu', id: 'accessories', label: 'Accessories', items: accItems });
			var colorItems = [];
			for (var ci = 0; ci < colorPresets.length; ci++) {
				var preset = colorPresets[ci];
				colorItems.push({ type: 'action', id: 'color:' + preset.color, label: preset.label, enabled: true, checked: color === preset.color });
			}
			items.push({ type: 'submenu', id: 'changeColor', label: 'Change Color', items: colorItems });
			return items;
		}

		function showContextMenu(event) {
			event.preventDefault();
			event.stopPropagation();
			dismissBounceResult();
			if (typeof window.__BETTER_PET_MENU__ === 'function') {
				window.__BETTER_PET_MENU__(event, JSON.stringify(buildMenuItems()));
			}
		}

		function setColor(value) {
			color = value;
			storageSet('color', value);
			var newVariant = getChatPetColorVariant(value);
			var variantChanged = newVariant !== variant;
			variant = newVariant;
			eyes.style.color = getChatPetEyeColor(value);
			if (variantChanged) {
				// Re-render with the new variant's sprites.
				renderState(renderedState || 'idle', true, isDragging);
			} else {
				if (activeSprite && activeSprite.redrawFrame) { activeSprite.redrawFrame(); }
			}
			status('VS Code pet color changed');
		}

		/* --- animation end handling (yapping fall → mouth open) --------------------- */
		button.addEventListener('animationend', function (event) {
			if (event.animationName === 'chat-pet-enter') {
				button.classList.remove('entering');
			} else if (event.animationName === 'chat-pet-yapping-fall' && !isDragging && button.getAttribute('data-state') === 'yapping') {
				transientState = 'yappingMouthOpen';
				renderState('yappingMouthOpen', true);
			} else if ((event.animationName === 'chat-pet-eye-blink' || event.animationName === 'chat-pet-tall-eye-blink') && event.target === pupils[0]) {
				blinkController.onAnimationComplete();
			}
		});
		button.addEventListener('animationcancel', function (event) {
			if ((event.animationName === 'chat-pet-eye-blink' || event.animationName === 'chat-pet-tall-eye-blink') && event.target === pupils[0]) {
				blinkController.onAnimationComplete();
			}
		});
		button.addEventListener('transitionend', function (event) {
			if (event.target === button && event.propertyName === 'top' && button.classList.contains('falling')) {
				finishFall();
			}
		});
		button.addEventListener('transitioncancel', function (event) {
			if (event.target === button && event.propertyName === 'top' && button.classList.contains('falling')) {
				finishFall();
			}
		});

		/* --- listeners --------------------------------------------------------------- */
		button.addEventListener('pointerdown', startDrag);
		button.addEventListener('click', onButtonClick);
		button.addEventListener('contextmenu', showContextMenu);

		document.addEventListener('pointermove', function (event) {
			trackCursor(event);
			if (enabled && doesChatPetStateTrackCursor(renderedState)) { updateGaze(); }
		});

		window.addEventListener('resize', function () {
			if (!isDragging && !isAirborne()) { updateRestingPosition(); }
		});

		// Re-measure the floor when the editor part's layout settles or changes
		// (modern UI applies its card border/margins via CSS that can land after
		// the first paint). ResizeObserver on the host catches border-induced
		// size changes; one on the part catches its own resizes.
		if (typeof ResizeObserver === 'function') {
			var relayout = function () {
				if (!isDragging && !isAirborne()) { updateRestingPosition(); }
			};
			var hostObserver = new ResizeObserver(relayout);
			hostObserver.observe(root);
			if (root.parentElement) {
				var partObserver = new ResizeObserver(relayout);
				partObserver.observe(root.parentElement);
			}
		}

		var reducedMotionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : undefined;
		function applyReducedMotion() {
			var wasReduced = motionReduced;
			motionReduced = !!(reducedMotionQuery && reducedMotionQuery.matches);
			if (motionReduced) { blinkController.setEnabled(false); }
			if (!wasReduced && motionReduced && button.classList.contains('throwing')) { finishThrow(false); }
		}
		applyReducedMotion();
		if (reducedMotionQuery && reducedMotionQuery.addEventListener) {
			reducedMotionQuery.addEventListener('change', applyReducedMotion);
		}

		document.addEventListener('visibilitychange', function () {
			if (!document.hidden) { updateEyes(renderedState); }
		});

		// Typing while coding → the pet types along.
		document.addEventListener('keydown', function (event) {
			if (enabled && isTypingKey(event)) {
				setTypingActive(true);
			}
		}, true);

		// Events forwarded from the extension host (e.g. task succeeded).
		root.addEventListener('betterpet-notify', function (event) {
			var detail = event.detail;
			if (!enabled) { return; }
			if (detail === 'clapping') {
				wake();
				showTransientState('clapping');
				status('The VS Code pet is applauding the completed task');
			}
		});

		/* --- text-cursor avoidance --------------------------------------------------- */
		// The pet keeps its distance from the editor's text caret by hopping away
		// while grounded (hops ignore the caret while airborne). Cornered pets go
		// on the run until the caret leaves range.
		function findTextCursor() {
			var editorPart = document.getElementById('workbench.parts.editor');
			var nodes = document.querySelectorAll('.monaco-editor .cursor');
			for (var i = 0; i < nodes.length; i++) {
				var el = nodes[i];
				if (editorPart && !editorPart.contains(el)) { continue; }
				var cs = getComputedStyle(el);
				if (cs.visibility === 'hidden' || cs.display === 'none') { continue; }
				var r = el.getBoundingClientRect();
				if (r.width > 0 && r.height > 0) {
					return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
				}
			}
			return undefined;
		}

		// Caret center in overlay-relative coordinates.
		function caretCenter() {
			var cursor = findTextCursor();
			if (!cursor) { return undefined; }
			var b = overlayRect();
			return { x: cursor.x - b.left, y: cursor.y - b.top };
		}

		// Grounded pet center in overlay-relative coordinates.
		function petGroundedCenter() {
			var size = displaySize();
			return { x: baseLeft + size / 2, y: floorTop() - size / 2 };
		}

		/**
		 * Faithful port of the built-in pet's ChatPetHopController (the hop the
		 * arrow keys trigger). A hop is the `jump` sprite animation: the pet
		 * shifts horizontally by HOP_DISTANCE at the jump apex, then rests
		 * briefly before the next hop while requests keep arriving.
		 */
		var hopController = (function () {
			var direction = 0;
			var heldUntil = 0;
			var active = false;
			var stepTimer = null;
			var restTimer = null;

			function clearStep() { if (stepTimer !== null) { clearTimeout(stepTimer); stepTimer = null; } }
			function clearRest() { if (restTimer !== null) { clearTimeout(restTimer); restTimer = null; } }

			function cancel() {
				active = false;
				direction = 0;
				heldUntil = 0;
				clearStep();
				clearRest();
			}

			function beginHop() {
				active = true;
				clearStep();
				clearRest();
				transientState = 'jump';
				renderState('jump', true);
				stepTimer = setTimeout(applyStep, HOP_APEX_DELAY);
			}

			function applyStep() {
				stepTimer = null;
				if (!active || direction === 0) { return; }
				var bounds = getHorizontalBounds();
				if (!bounds) { return; }
				setHorizontalPosition(getCurrentLeft() + direction * HOP_DISTANCE, true);
				updateVerticalPosition();
			}

			function onAnimationComplete() {
				if (!active) { return; }
				if (now() < heldUntil) {
					clearRest();
					restTimer = setTimeout(beginHop, HOP_REST_DELAY);
				} else {
					active = false;
				}
			}

			return {
				request: function (dir, reducedMotion) {
					direction = dir;
					button.setAttribute('data-hop-direction', dir < 0 ? 'left' : 'right');
					// Keep the jump state alive while requests keep coming, then
					// clear it shortly after the last request.
					clearTimeout(transientTimer);
					transientTimer = setTimeout(function () { transientState = undefined; renderLoop(); }, HOP_IDLE_DEBOUNCE);
					if (reducedMotion) {
						cancel();
						var bounds = getHorizontalBounds();
						if (bounds) {
							setHorizontalPosition(getCurrentLeft() + dir * HOP_DISTANCE, true);
							updateVerticalPosition();
						}
						return;
					}
					heldUntil = now() + HOP_HOLD_GRACE;
					if (!active) { beginHop(); }
				},
				cancel: cancel,
				onAnimationComplete: onAnimationComplete,
			};
		})();

		/**
		 * Grounded caret-avoidance controller. Runs on a low-frequency timer
		 * (the caret only moves on user input) and decides, in order: recover
		 * from an automatic run, hop away, or go on the run when cornered.
		 */
		function applyCursorAvoidance() {
			function tick() {
				avoidanceTimer = setTimeout(tick, HOP_AVOID_INTERVAL);
				if (document.hidden || !enabled) { return; }
				if (isDragging || isAirborne()) { return; }
				if (transientState === 'dizzy') {
					// Dizzy: pause avoidance and cancel any in-flight hop until
					// the pet recovers.
					hopController.cancel();
					return;
				}

				var size = displaySize();
				var maxLeft = Math.max(0, overlayRect().width - size);
				var caret = caretCenter();

				if (onTheRun) {
					if (cursorRun && caret) {
						var pet = petGroundedCenter();
						if (Math.hypot(caret.x - pet.x, caret.y - pet.y) >= CURSOR_CLEAR_DISTANCE) {
							cursorRun = false;
							setOnTheRun(false);
						}
					}
					return;
				}

				if (!caret) {
					hopController.cancel();
					return;
				}
				var center = petGroundedCenter();
				var distance = Math.hypot(caret.x - center.x, caret.y - center.y);
				if (distance >= CURSOR_CLEAR_DISTANCE) {
					hopController.cancel();
					return;
				}

				// The caret is close: wake the pet so it doesn't hop straight
				// back to sleep afterwards.
				wake();

				// Hop directly away from the caret (or toward the side with more
				// room when the caret is right above/below).
				var direction = Math.abs(center.x - caret.x) >= 1
					? (center.x > caret.x ? 1 : -1)
					: ((maxLeft - center.x) >= center.x ? 1 : -1);

				// Cornered if the next hop wouldn't actually move the pet away.
				var target = clamp(baseLeft + direction * HOP_DISTANCE, 0, maxLeft);
				if (Math.abs(target - baseLeft) < 1) {
					hopController.cancel();
					cursorRun = true;
					setOnTheRun(true);
					return;
				}
				hopController.request(direction, motionReduced);
			}
			tick();
		}

		/* --- boot ---------------------------------------------------------------------- */
		setScale(scale);
		restoreHorizontalPosition();
		updateVerticalPosition();
		button.classList.add('entering');
		renderLoop();
		scheduleIdle();
		updateGaze();
		applyCursorAvoidance();
		setTimeout(function () { button.classList.remove('entering'); }, 320);

		// Native-menu action dispatcher (called by the overlay bridge).
		window.__BETTER_PET_RUN_ACTION__ = runMenuAction;

		/* --- expose a tiny API for debugging ------------------------------------------ */
		window.__BETTER_PET_API__ = {
			setState: function (state) { showTransientState(state); },
			setColor: setColor,
			setAccessory: switchAccessory,
			setScale: setScale,
			setOnTheRun: setOnTheRun,
			notify: function (type) {
				if (type === 'clapping') { wake(); showTransientState('clapping'); }
				else if (type === 'typing') { setTypingActive(true); }
			},
			confetti: function () { bounceCount = CONFETTI_SCORE; showBounceConfetti(); },
			debugAvoidance: function () {
				var caret = caretCenter();
				var center = petGroundedCenter();
				var distance = caret && center ? Math.hypot(caret.x - center.x, caret.y - center.y) : Infinity;
				return JSON.stringify({ baseLeft: baseLeft, caret: caret, center: center, distance: Math.round(distance), clearDistance: CURSOR_CLEAR_DISTANCE, onTheRun: onTheRun, cursorRun: cursorRun, airborne: isAirborne(), dragging: isDragging, enabled: enabled });
			},
			debugGeometry: function () {
				var part = ROOT.parentElement;
				var r = function (e) {
					if (!e) { return null; }
					var x = e.getBoundingClientRect();
					return { top: Math.round(x.top), bottom: Math.round(x.bottom), left: Math.round(x.left), right: Math.round(x.right), w: Math.round(x.width), h: Math.round(x.height) };
				};
				var cs = part ? getComputedStyle(part) : null;
				return JSON.stringify({
					part: r(part),
					host: r(ROOT),
					button: r(button),
					partBorderTop: cs ? cs.borderTopWidth : null,
					partBorderBottom: cs ? cs.borderBottomWidth : null,
					partMarginBottom: cs ? cs.marginBottom : null,
					floor: Math.round(floorTop()),
					displaySize: displaySize(),
				});
			},
		};
	}

	/* Boot */
	try {
		new ChatPet(ROOT);
		window.__BETTER_PET_STATUS__ = 'ran';
	} catch (err) {
		window.__BETTER_PET_STATUS__ = 'error: ' + (err && err.message);
	}
})();
