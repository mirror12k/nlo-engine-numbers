
nlo = {
	load: {
		load_image: function(url, callback) {
			var image = new Image();
			image.addEventListener('load', () => callback(image));
			image.addEventListener('error', function (e) {
				console.log("error loading image:", image, e);
			});
			// image.setAttribute('crossorigin', 'anonymous');
			image.src = url;
			image.dataset.url = url;
			console.log("wat:", image);
		},
		load_image_onpage: function(url, callback) {
			var img = document.querySelector("img[data-url='" + url + "']");
			if (img)
				callback(img);
			else
				nlo.load.load_image(url, callback);
		},
		load_audio: function(url, callback) {
			var audio = new Audio();
			// audio.addEventListener('canplaythrough', callback.bind(undefined, audio));
			var loaded = false;
			audio.addEventListener('canplaythrough', function () {
				if (!loaded) {
					loaded = true;
					callback(audio);
				}
			});
			audio.addEventListener('error', function (e) {
				console.log("error loading audio:", audio, e);
			});
			audio.preload = "auto";
			audio.src = url;
			audio.load();
			// audio.play();
		},

		load_all_assets: function(assets, callback) {
			var images = assets.images;
			var audio = assets.audio;

			var loaded_assets = {
				images: {},
				audio: {},
			};
			var count_loaded = 0;
			var count_expected = 0;
			if (images) {
				count_expected += Object.keys(images).length;
			}
			if (audio) {
				count_expected += Object.keys(audio).length;
			}

			if (images) {
				var keys = Object.keys(images);
				for (var i = 0; i < keys.length; i++) {
					nlo.load.load_image_onpage(images[keys[i]], (function (key, image) {
						// console.log("loaded image:", image);
						loaded_assets.images[key] = image;

						count_loaded++;
						if (count_loaded >= count_expected)
							callback(loaded_assets);
					}).bind(undefined, keys[i]));
				}
			}
			if (audio) {
				var keys = Object.keys(audio);
				for (var i = 0; i < keys.length; i++) {
					nlo.load.load_audio(audio[keys[i]], (function (key, audio_data) {
						// console.log("loaded audio:", audio_data);
						loaded_assets.audio[key] = audio_data;

						count_loaded++;
						if (count_loaded >= count_expected)
							callback(loaded_assets);
					}).bind(undefined, keys[i]));
				}
			}
		},
	},
};

function GameSystem(canvas, assets) {
	this.canvas = canvas;
	canvas.game_system = this;
	this.images = assets.images;
	this.audio = assets.audio;

	this.entities = [];
	// this.entities_to_add = [];
	// this.entities_to_remove = [];

	this.game_systems = {};
	this.particle_systems = {};

	this.background_color = '#000';

	this.previous_keystate = {};
	this.keystate = {
		W: false,
		A: false,
		S: false,
		D: false,
		shift: false,
		ctrl: false,
		alt: false,
		
		space: false,
		left: false,
		up: false,
		right: false,
		down: false,
	};
	this.previous_mouse1_state = false;
	this.mouse1_state = false;
	this.mouse_position = { px: 0, py: 0 };

	document.addEventListener('keydown', (function (e) {
		e = e || window.event;
		if (!this.keystate.ctrl)
			e.preventDefault();
		var charcode = String.fromCharCode(e.keyCode);
		this.keystate[e.key] = true;
		this.keystate.shift = !!e.shiftKey;
		this.keystate.ctrl = !!e.ctrlKey;
		this.keystate.alt = !!e.altKey;
		// console.log('keydown: ', e.keyCode, e.key, this.keystate);
	}).bind(this));

	document.addEventListener('keyup', (function (e) {
		e = e || window.event;
		if (!this.keystate.ctrl)
			e.preventDefault();
		var charcode = String.fromCharCode(e.keyCode);
		this.keystate[e.key] = false;
		// if (e.keyCode === 37)
		// 	this.keystate.left = false;
		// else if (e.keyCode === 38)
		// 	this.keystate.up = false;
		// else if (e.keyCode === 39)
		// 	this.keystate.right = false;
		// else if (e.keyCode === 40)
		// 	this.keystate.down = false;
		// else if (e.keyCode === 187)
		// 	this.keystate['='] = false;
		// else if (e.keyCode === 189)
		// 	this.keystate['-'] = false;
		// else if (charcode === ' ')
		// 	this.keystate.space = false;
		// // else if (charcode === '0')
		// // 	this.keystate.number_0 = false;
		// // else if (charcode === '1')
		// // 	this.keystate.number_1 = false;
		// // else if (charcode === '2')
		// // 	this.keystate.number_2 = false;
		// // else if (charcode === '3')
		// // 	this.keystate.number_3 = false;
		// // else if (charcode === '4')
		// // 	this.keystate.number_4 = false;
		// // else if (charcode === '5')
		// // 	this.keystate.number_5 = false;
		// // else if (charcode === '6')
		// // 	this.keystate.number_6 = false;
		// // else if (charcode === '7')
		// // 	this.keystate.number_7 = false;
		// // else if (charcode === '8')
		// // 	this.keystate.number_8 = false;
		// // else if (charcode === '9')
		// // 	this.keystate.number_9 = false;
		// else
		// 	this.keystate[charcode] = false;
		this.keystate.shift = !!e.shiftKey;
		this.keystate.ctrl = !!e.ctrlKey;
		this.keystate.alt = !!e.altKey;
		// console.log('keyup: ', charcode);
	}).bind(this));

	var self = this;
	this.canvas.addEventListener('mousedown', function (e) {
		var x = e.x - this.getBoundingClientRect().left;
		var y = e.y - this.getBoundingClientRect().top;
		self.mouse_position = { px: x, py: y };
		self.mouse_game_position = self.camera ? self.camera.translate_coordinates_to_world(self.mouse_position) : self.mouse_position;
		self.mouse1_state = true;
		// console.log("mousedown: ", x, y);
	});
	this.canvas.addEventListener('mouseup', function (e) {
		var x = e.x - this.getBoundingClientRect().left;
		var y = e.y - this.getBoundingClientRect().top;
		self.mouse_position = { px: x, py: y };
		self.mouse_game_position = self.camera ? self.camera.translate_coordinates_to_world(self.mouse_position) : self.mouse_position;
		self.mouse1_state = false;
		// console.log("mouseup: ", x, y);
	});
	this.canvas.addEventListener('mousemove', function (e) {
		var x = e.x - this.getBoundingClientRect().left;
		var y = e.y - this.getBoundingClientRect().top;
		self.mouse_position = { px: x, py: y };
		self.mouse_game_position = self.camera ? self.camera.translate_coordinates_to_world(self.mouse_position) : self.mouse_position;
		// console.log("mousemove: ", x, y);
		// console.log("mousemove: " + self.mouse_game_position.px + ',' + self.mouse_game_position.py);
	});
}
GameSystem.prototype.run_game = function(ctx, fps) {
	this.last_timestamp = new Date().getTime();
	setInterval(this.step_game_frame.bind(this, ctx), 1000 / fps);
}
GameSystem.prototype.step_game_frame = function(ctx) {
	var time = new Date().getTime();
	this.deltatime = (time - this.last_timestamp) / 1000;
    this.last_timestamp = time;

	this.update();
	
	this.draw(ctx);
};
GameSystem.prototype.update = function () {
	try {
		// update all entities
		for (var ent of this.entities.filter(e => e.active)) {
			this.context_container = ent;
			ent.update(this);
		}

		// update all game systems
		for (var key of Object.keys(this.game_systems)) {
			this.context_container = this.game_systems[key];
			this.game_systems[key].update(this);
		}


		// update particle systems
		for (var key of Object.keys(this.particle_systems)) {
			this.particle_systems[key].update(this);
		}

		// refresh key and mouse states
		this.previous_keystate = this.keystate;
		this.keystate = Object.assign({}, this.keystate);
		this.previous_mouse1_state = this.mouse1_state;

	} catch (e) {
		// console.error('exception during update:', e.message);
		console.error('exception stack:', e.stack);
	}

	this.context_container = undefined;
};
GameSystem.prototype.draw = function (ctx) {
	ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

	ctx.fillStyle = this.background_color;
	ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

	var entities_to_draw = this.entities.filter(e => e.active);
	entities_to_draw.sort(function (a, b) { return a.z_index - b.z_index; });
	var game_systems_to_draw = Object.values(this.game_systems);
	game_systems_to_draw.sort(function (a, b) { return a.z_index - b.z_index; });
	var particle_systems_to_draw = Object.values(this.particle_systems);
	particle_systems_to_draw.sort(function (a, b) { return a.z_index - b.z_index; });

	ctx.save();

	for (var system of game_systems_to_draw) {
		if (system.z_index < 0) {
			system.draw(ctx);
		}
	}

	for (var particle_system of particle_systems_to_draw) {
		if (particle_system.z_index < 0) {
			particle_system.draw(ctx);
		}
	}

	ctx.save();
	// apply camera transformations if we have a camera
	if (this.camera) {
		ctx.translate(+this.camera.width / 2, +this.camera.height / 2);
		ctx.rotate(Math.PI * -this.camera.angle / 180);
		ctx.scale(this.camera.scalex, this.camera.scaley);
		ctx.translate(-this.camera.px, -this.camera.py);
	}

	for (var ent of entities_to_draw) {
		ent.draw(ctx);
	}
	ctx.restore();

	for (var particle_system of particle_systems_to_draw) {
		if (particle_system.z_index >= 0) {
			particle_system.draw(ctx);
		}
	}

	for (var system of game_systems_to_draw) {
		if (system.z_index >= 0) {
			system.draw(ctx);
		}
	}

	ctx.restore();
};

GameSystem.prototype.add_entity = function(ent) {
	ent.parent = this;
	this.entities.push(ent);
};
GameSystem.prototype.add_entities = function(ents) {
	ents.forEach(e => this.add_entity(e));
};
GameSystem.prototype.remove_entity = function(ent) {
	var index = this.entities.indexOf(ent);
	if (index !== -1)
		this.entities.splice(index, 1);
};
GameSystem.prototype.remove_entities = function(ents) {
	this.entities = this.entities.filter(e => !ents.includes(e));
};

GameSystem.prototype.query_entities = function(type) { return this.entities.filter(e => e instanceof type); };
GameSystem.prototype.is_mouse_pressed = function() { return !game.previous_mouse1_state && game.mouse1_state; };
GameSystem.prototype.is_mouse_released = function() { return game.previous_mouse1_state && !game.mouse1_state; };
GameSystem.prototype.is_key_pressed = function(k) { return this.keystate[k] && !this.previous_keystate[k]; };
GameSystem.prototype.is_key_released = function(k) { return !this.keystate[k] && this.previous_keystate[k]; };

GameSystem.prototype.move_camera = function(px, py) {
	this.camera.px = px;
	this.camera.py = py;

	this.mouse_game_position = this.camera.translate_coordinates_to_world(this.mouse_position);
};
GameSystem.prototype.rescale_camera = function(scalex, scaley) {
	this.camera.scalex = scalex;
	this.camera.scaley = scaley;

	this.mouse_game_position = this.camera.translate_coordinates_to_world(this.mouse_position);
};
GameSystem.prototype.rotate_camera = function(angle) {
	this.camera.angle = angle;
	
	this.mouse_game_position = this.camera.translate_coordinates_to_world(this.mouse_position);
};

GameSystem.prototype.find_at = function(type, p) {
	var found = this.entities
			.filter(e => e instanceof type)
			.filter(e => Math.abs(e.px - p.px) < e.width / 2 && Math.abs(e.py - p.py) < e.height / 2);
	found.sort((a,b) => Math.abs(a.px - p.px) + Math.abs(a.py - p.py) - (Math.abs(b.px - p.px) + Math.abs(b.py - p.py)));
	return found[0];
};

GameSystem.prototype.find_colliding_rectangular = function(me, type) {
	var found = [];
	for (var i = 0; i < this.entities.length; i++) {
		var ent = this.entities[i];
		if (ent instanceof type) {
			if (Math.abs(ent.px - me.px) < (ent.width + me.width) / 2 && Math.abs(ent.py - me.py) < (ent.height + me.height) / 2) {
				found.push(ent);
			}
		}
	}

	return found;
};

function GameCamera(width, height) {
	this.width = width;
	this.height = height;

	this.scalex = 1;
	this.scaley = 1;

	this.px = this.width / 2;
	this.py = this.height / 2;
	this.angle = 0;
}
GameCamera.prototype.translate_coordinates_to_world = function(pxy) {
	var offset = d2_point_offset(this.angle, pxy.px - this.width / 2, pxy.py - this.height / 2);
	return { px: this.px + offset.px / this.scalex, py: this.py + offset.py / this.scaley };
};



function Entity(game) {
	this.sub_entities = [];
	this.coroutine_callbacks = [];
	this.until_callbacks = [];
	this.active = true;
}
Entity.prototype.z_index = 0;
Entity.prototype.update = function(game) {
	this.sub_entities.filter(e => e.active).forEach(e => e.update(game));

	for (var i = this.until_callbacks.length - 1; i >= 0; i--) {
		var coro = this.until_callbacks[i];
		coro.timer -= game.deltatime;
		if (coro.condition ? !coro.condition() : coro.timer > 0) {
			coro.callback();
		} else {
			if (coro.onend)
				coro.onend();
			this.until_callbacks.splice(i, 1);
		}
	}

	for (var i = this.coroutine_callbacks.length - 1; i >= 0; i--) {
		var coro = this.coroutine_callbacks[i];
		coro.timer -= game.deltatime;
		if (coro.timer <= 0) {
			if (coro.interval !== undefined) {
				coro.timer += coro.interval;
			} else {
				this.coroutine_callbacks.splice(i, 1);
			}
			coro.callback();
		}
	}
};
Entity.prototype.draw = function(ctx) {
	var entities_to_draw = this.sub_entities.filter(e => e.active);
	entities_to_draw.sort(function (a, b) { return a.z_index - b.z_index; });
	entities_to_draw.forEach(e => e.draw(ctx));
};
Entity.prototype.transition = function(delta, callback) {
	var c = { timer: delta };
	c.callback = () => callback((delta - c.timer) / delta);
	c.onend = () => callback(1);
	this.until_callbacks.push(c);
	return c;
};
Entity.prototype.until = function(condition, callback, onend) {
	this.until_callbacks.push({
		condition: condition,
		callback: callback,
		onend: onend,
	});
};
Entity.prototype.every = function(delta, callback) {
	this.coroutine_callbacks.push({
		timer: delta,
		interval: delta,
		callback: callback,
	});
};
Entity.prototype.after = function(delta, callback) {
	this.coroutine_callbacks.push({
		timer: delta,
		callback: callback,
	});
};
Entity.prototype.cancel_transistion = function(transition) {
	var index = this.until_callbacks.indexOf(transition);
	if (index !== -1)
		this.until_callbacks.splice(index, 1);
};
Entity.prototype.add_entity = function(ent) {
	ent.parent = this;
	this.sub_entities.push(ent);
};
Entity.prototype.remove_entity = function(ent) {
	var index = this.sub_entities.indexOf(ent);
	if (index !== -1)
		this.sub_entities.splice(index, 1);
};

Entity.prototype.remove_entities = function(ents) {
	this.sub_entities = this.sub_entities.filter(e => !ents.includes(e));
};

function ScreenEntity(game, px, py, width, height, image) {
	Entity.call(this, game);
	this.px = px;
	this.py = py;
	this.vx = 0;
	this.vy = 0;
	this.angle = 0;
	this.frame = 0;
	this.max_frame = 1;
	this.width = width;
	this.height = height;
	this.image = image;

	this.rotation = 0;
	this.alpha = 1;
}
ScreenEntity.prototype = Object.create(Entity.prototype);
ScreenEntity.prototype.constructor = ScreenEntity;
ScreenEntity.prototype.update = function(game) {
	Entity.prototype.update.call(this, game);
	if (this.rotation) {
		this.angle += this.rotation * game.deltatime;
		this.angle %= 360;
	}
	this.px += this.vx * game.deltatime;
	this.py += this.vy * game.deltatime;
};
ScreenEntity.prototype.draw = function(ctx) {
	ctx.save();

	ctx.globalAlpha = this.alpha;
	ctx.translate(this.px, this.py);
	ctx.rotate(this.angle * Math.PI / 180);
	// ctx.rotate(Math.PI * (Math.floor(this.angle / this.angle_granularity) * this.angle_granularity) / 180);

	var entities_to_draw = this.sub_entities.filter(e => e.active);
	entities_to_draw.sort(function (a, b) { return a.z_index - b.z_index; });
	entities_to_draw.filter(e => e.z_index < this.z_index).forEach(e => e.draw(ctx));
	this.draw_self(ctx);
	entities_to_draw.filter(e => e.z_index >= this.z_index).forEach(e => e.draw(ctx));

	ctx.restore();
};
ScreenEntity.prototype.draw_self = function(ctx) {
	if (this.image)
		ctx.drawImage(this.image,
			this.frame * (this.image.width / this.max_frame), 0, this.image.width / this.max_frame, this.image.height,
			0 - this.width / 2, 0 - this.height / 2, this.width, this.height);
};
ScreenEntity.prototype.contains_point = function(p) {
	return Math.abs(p.px - this.px) < this.width / 2 && Math.abs(p.py - this.py) < this.height / 2;
};

function lerp(a, b, f) { return a * (1 - f) + b * f; }
function vector_delta(p1,p2) { return { px: p2.px - p1.px, py: p2.py - p1.py }; }
function vector_length(p) { return Math.sqrt(p.px ** 2 + p.py ** 2); }
function dist_sqr(p1,p2) { return (p1.px - p2.px) ** 2 + (p1.py - p2.py) ** 2; }
function dist(p1,p2) { return Math.sqrt((p1.px - p2.px) ** 2 + (p1.py - p2.py) ** 2); }
function unit_vector(p) { var d = vector_length(p); return { px: p.px/d, py: p.py/d }; }

