
var game;


function UserInputService() {
	Entity.call(this, game);
	// this.add_entity(this.rotation_thing = new ScreenEntity(game, -100,-100, 32, 32, game.images.rotate_icon));
	this.add_entity(this.running_sum_text = new TextDisplay(5,game.canvas.height - 5));
	this.add_entity(this.note_text = new TextDisplay(5,game.canvas.height - 35, "Press T to enter/exit play mode"));
	// this.rotation_thing.active = false;

	this.level_index = 0;
	this.levels_data = [
		[[1,318,212],[1,375,255],[1,432,210]],
		[[1,430,189],[-1,386,244],[1,411,316],[-1,467,255]],
		[[1,436,163],[-1,369,208],[1,562,242],[-1,497,204],[1,313,253],[-1,311,328],[-1,312,412],[-1,371,461],[1,436,512],[-1,500,464],[1,563,409],[1,565,325]],
		[[1,454,185],[1,393,225],[-1,452,258],[-2,450,331],[1,388,289],[-1,324,256],[1,509,292],[-1,511,223],[1,579,251]],
		[[-5,486,156],[4,572,120],[-3,605,195],[3,521,236],[1,437,282],[-1,375,342],[1,339,425]],
	];
	this.is_levels = false;
	this.is_edit_mode = true;
	this.is_transition_mode = false;
}
UserInputService.prototype = Object.create(Entity.prototype);
UserInputService.prototype.update = function(game) {
	Entity.prototype.update.call(this, game);

	if (this.is_transition_mode)
		this.update_transition();
	else if (this.is_edit_mode)
		this.update_editor();
	else
		this.update_game();
};
UserInputService.prototype.set_is_game = function (is_game) {
	this.is_edit_mode = !is_game;
	game.query_entities(TemplateThing).forEach(t => t.active = this.is_edit_mode);
	this.note_text.active = !is_game;
	this.running_sum_text.active = !is_game;
};
UserInputService.prototype.start_level = function (index) {
	if (index < this.levels_data.length) {
		this.reload_data(this.levels_data[index]);
		this.is_edit_mode = false;
		this.is_levels = true;
		this.set_is_game(true);
	} else {
		this.reload_data([]);
		this.is_edit_mode = true;
		this.is_levels = false;
		this.set_is_game(false);
	}
};

UserInputService.prototype.update_transition = function () {
};
UserInputService.prototype.update_game = function () {
	// check if we need to go back to the editor
	if (game.is_key_pressed('t') && !this.is_levels) {
		this.set_is_game(false);
		this.reload_data(this.saved_game_data);
	}

	// check if the player clicked the mouse button
	if (game.is_mouse_pressed()) {
		// check if we clicked on a rotation handle
		if (
				// try to find an existing ent
				(this.interacting_ent = game.find_at(NumberCircle, game.mouse_game_position))) {

			// show the running sum
			this.running_sum_text.active = true;

			// prep our chain and sum
			var chain = [this.interacting_ent];
			var chain_connectors = [];
			var running_sum = this.interacting_ent.value;

			// drag it until the player releases the mouse button
			this.until(() => !game.mouse1_state || running_sum < 0 || this.is_transition_mode, () => {
				// update text
				this.running_sum_text.text = "" + running_sum;
				// mark the current ent in blue color
				this.interacting_ent.is_used = true;
				// search for a new ent to connect to
				var other = game.find_at(NumberCircle, game.mouse_game_position);
				// if the ent isn't in the chain but is connectable
				if (other && other != this.interacting_ent
					&& !chain.includes(other)
					&& this.interacting_ent.connected.includes(other)
					&& running_sum + other.value >= 0) {

					// add a connected chain element

					// create the new connector
					var connector = new CircleChainConnector(this.interacting_ent, other);
					game.add_entity(connector);
					chain_connectors.push(connector);

					// update chain and sum
					this.interacting_ent = other;
					chain.push(this.interacting_ent);
					running_sum += this.interacting_ent.value;

					// check if we have completed the level
					if (game.query_entities(NumberCircle).length === chain.length && running_sum >= 0) {
						// change state
						this.is_transition_mode = true;
						// scatter the chain
						chain.forEach((n,i) => n.after(i * 0.1, () => n.is_fleeing = true));

						// after 3 seconds, complete the transition
						this.after(3, () => {
							this.is_transition_mode = false;
							// clean up
							game.remove_entities(chain);
							if (this.is_levels) {
								// if this is levels mode, we play the next level
								console.log("next level!");
								this.start_level(++this.level_index);
							} else {
								// if this is editor mode, go back to editor
								this.set_is_game(false);
								this.reload_data(this.saved_game_data);
							}
						});
					}

				// if the ent is the previous one in the chain
				} else if (other && other != this.interacting_ent
					&& chain.includes(other) && chain[chain.length - 2] === other) {

					// remove a connected chain element

					// update chain and sum
					this.interacting_ent.is_used = false;
					running_sum -= this.interacting_ent.value;
					chain.pop();
					this.interacting_ent = chain[chain.length - 1];

					// remove the last connector
					game.remove_entity(chain_connectors.pop());
				}
			}, () => {
				// when player releases mouse, we clean up
				chain.forEach(n => n.is_used = false);
				this.interacting_ent = undefined;
				game.remove_entities(chain_connectors);
				this.running_sum_text.active = false;
			});
		}
	}
};
UserInputService.prototype.update_editor = function () {
	if (game.is_mouse_pressed()) {
		// check if we clicked on a rotation handle
		if (
				// try to find a template on the player's mouse click
				(this.templating_ent = game.find_at(TemplateThing, game.mouse_game_position))
				// or try to find an existing ent
				|| (this.interacting_ent = game.find_at(NumberCircle, game.mouse_game_position))) {

			// if they clicked a template, clone it and drag it in
			if (this.templating_ent)
				game.add_entity(this.interacting_ent = new NumberCircle(game.mouse_game_position.px, game.mouse_game_position.py));

			// calculate the dragging offset
			var delta = { px: this.interacting_ent.px - game.mouse_game_position.px, py: this.interacting_ent.py - game.mouse_game_position.py };

			// drag it until the player releases the mouse button
			this.until(() => !game.mouse1_state, () => {
				this.interacting_ent.px = game.mouse_game_position.px + delta.px;
				this.interacting_ent.py = game.mouse_game_position.py + delta.py;
			});
		}
	}

	if (game.is_key_pressed('=')) {
		if (this.interacting_ent) {
			this.interacting_ent.value = Math.abs(this.interacting_ent.value);
		}
	} else if (game.is_key_pressed('-')) {
		if (this.interacting_ent) {
			this.interacting_ent.value = -Math.abs(this.interacting_ent.value);
		}
	} else if (game.is_key_pressed('1')) {
		if (this.interacting_ent) {
			this.interacting_ent.value = Math.sign(this.interacting_ent.value) * 1;
		}
	} else if (game.is_key_pressed('2')) {
		if (this.interacting_ent) {
			this.interacting_ent.value = Math.sign(this.interacting_ent.value) * 2;
		}
	} else if (game.is_key_pressed('3')) {
		if (this.interacting_ent) {
			this.interacting_ent.value = Math.sign(this.interacting_ent.value) * 3;
		}
	} else if (game.is_key_pressed('4')) {
		if (this.interacting_ent) {
			this.interacting_ent.value = Math.sign(this.interacting_ent.value) * 4;
		}
	} else if (game.is_key_pressed('5')) {
		if (this.interacting_ent) {
			this.interacting_ent.value = Math.sign(this.interacting_ent.value) * 5;
		}
	} else if (game.is_key_pressed('s')) {
		var data = this.save_data();
		this.reload_data(data);
	} else if (game.is_key_pressed('t')) {
		this.set_is_game(true);
		this.saved_game_data = this.save_data();
		this.reload_data(this.saved_game_data);
	}

	this.running_sum_text.active = true;
	var sum = game.query_entities(NumberCircle).map(n => n.value).reduce((partial_sum, a) => partial_sum + a, 0);
	this.running_sum_text.text = "total value: " + (sum > 0 ? '+' : '') + sum;

};
UserInputService.prototype.save_data = function () {
	var data = game.query_entities(NumberCircle).map(n => [n.value, Math.round(n.px), Math.round(n.py)]);
	console.log("data:", JSON.stringify(data));
	return data;
};
UserInputService.prototype.reload_data = function (data) {
	// console.log("data:", data);
	game.remove_entities(game.query_entities(NumberCircle));
	game.remove_entities(game.query_entities(CircleConnector));
	game.add_entities(data.map(d => new NumberCircle(d[1],d[2], d[0])));
};

function TemplateThing(px, py) {
	ScreenEntity.call(this, game, px, py, 48, 48, game.images.circle);
}
TemplateThing.prototype = Object.create(ScreenEntity.prototype);


function NumberCircle(px, py, value=1) {
	ScreenEntity.call(this, game, px, py, 48, 48, game.images.circle);
	this.connected = [];
	this.connector_ents = [];
	this.lastpx = -1000;
	this.lastpy = -1000;

	this.value = value;
	this.color = '#e92';
	this.used_color = '#668';

	this.is_used = false;
	this.is_fleeing = false;
	this.flee_speed = 0;

	this.timer = Math.random() * 50;
}
NumberCircle.prototype = Object.create(ScreenEntity.prototype);
NumberCircle.prototype.draw_self = function (ctx) {
	ctx.save();
	ctx.translate(Math.sin(this.timer) * 3, Math.cos(this.timer) * 3);
	// ScreenEntity.prototype.draw_self.call(this, ctx);

	// ctx.beginPath();
	// ctx.fillStyle = "#c84";
	// ctx.arc(0, 0, 24, 0, Math.PI * 2);

	// var radgrad = ctx.createRadialGradient(60,60,0,60,60,60);
	//   // radgrad.addColorStop(0, '#c84');
	//   // radgrad.addColorStop(0.8, '#c844');
	//   // radgrad.addColorStop(1, 'rgba(228,0,0,0)');

	//   // draw shape
	//   ctx.fillStyle = radgrad;
	// ctx.fill();

	var radgrad = ctx.createRadialGradient(0,0,18,0,0,28);
	radgrad.addColorStop(0, (this.is_used ? this.used_color : this.color) + '');
	radgrad.addColorStop(0.8, (this.is_used ? this.used_color : this.color) + '8');
	radgrad.addColorStop(1, (this.is_used ? this.used_color : this.color) + '0');
	ctx.fillStyle = radgrad;
	ctx.fillRect(-28,-28,56,56);

	ctx.font = "bold 25px Arial";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillStyle = '#fc7';
	ctx.fillText((this.value > 0 ? '+' : '') + this.value, 0, 0);
	ctx.restore();
};
NumberCircle.prototype.update_connected = function () {
	if (this.active)
		this.connected = game.query_entities(NumberCircle).filter(n => n.active && n != this && dist_sqr(n, this) < (98 ** 2));
	else
		this.connected = [];

	game.remove_entities(this.connector_ents);
	game.add_entities(this.connector_ents = this.connected.map(n => new CircleConnector(this, n)));
};
NumberCircle.prototype.update = function (game) {
	ScreenEntity.prototype.update.call(this, game);



	if (this.is_fleeing) {
		this.flee_speed += game.deltatime;
		var delta = unit_vector(vector_delta(this, { px: game.canvas.width / 2, py: game.canvas.height / 2 }));
		this.px += -delta.px * game.deltatime * 250 * this.flee_speed;
		this.py += -delta.py * game.deltatime * 250 * this.flee_speed;
	} else if (this.px - this.width < 0 || this.px + this.width > game.canvas.width
			|| this.py - this.height < 0 || this.py + this.height > game.canvas.height) {
		var delta = unit_vector(vector_delta(this, { px: game.canvas.width / 2, py: game.canvas.height / 2 }));
		this.px += delta.px * game.deltatime * 50;
		this.py += delta.py * game.deltatime * 50;
	}


	if (this.lastpx != this.px || this.lastpy != this.py) {
		this.connected.forEach(n => n.update_connected());
		this.update_connected();
		this.connected.forEach(n => n.update_connected());
		this.lastpx = this.px;
		this.lastpy = this.py;
	}

	this.timer += game.deltatime;
};


function CircleConnector(p1, p2) {
	ScreenEntity.call(this, game, 0, 0, 32, 32, game.images.connector);
	this.set_points(p1,p2);

	this.z_index = -2;
}
CircleConnector.prototype = Object.create(ScreenEntity.prototype);
CircleConnector.prototype.set_points = function (p1, p2) {
	this.px = (p1.px + p2.px) / 2;
	this.py = (p1.py + p2.py) / 2;
	this.angle = Math.atan2(p2.py - p1.py, p2.px - p1.px) / Math.PI * 180;
	this.width = dist(p1, p2);
	this.height = Math.min((100 - this.width) * 2, 80);
};


function CircleChainConnector(p1, p2) {
	ScreenEntity.call(this, game, 0, 0, 32, 32, game.images.chain_connector);
	this.set_points(p1,p2);

	this.z_index = -1;
}
CircleChainConnector.prototype = Object.create(ScreenEntity.prototype);
CircleChainConnector.prototype.set_points = function (p1, p2) {
	this.px = (p1.px + p2.px) / 2;
	this.py = (p1.py + p2.py) / 2;
	this.angle = Math.atan2(p2.py - p1.py, p2.px - p1.px) / Math.PI * 180;
	this.width = dist(p1, p2);
	this.height = Math.min((100 - this.width) * 2, 80);
};
function TextDisplay(px, py, text="hello world!") {
	ScreenEntity.call(this, game, px, py, 1, 1, undefined);
	this.text = text;
}
TextDisplay.prototype = Object.create(ScreenEntity.prototype);
TextDisplay.prototype.draw = function (ctx) {
	ctx.save();
	ctx.translate(this.px, this.py);
	ctx.rotate(this.angle * Math.PI / 180);
	ctx.font = "30px Arial";
	ctx.fillStyle = '#ccc';
	ctx.fillText(this.text,0,0);
	ctx.restore();
};



function main () {
	var canvas = document.querySelector('#game_canvas');
	var ctx = canvas.getContext('2d');
	ctx.imageSmoothingEnabled = true;

	nlo.load.load_all_assets({
		images: {
			ufo: 'assets/img/ufo.png',
			circle: 'assets/img/circle.png',
			connector: 'assets/img/connector.png',
			chain_connector: 'assets/img/chain_connector.png',
		},
	}, loaded_assets => {
		game = new GameSystem(canvas, loaded_assets);
		game.background_color = '#333';

		// initialize all systems
		game.game_systems.user_input_service = new UserInputService(game);

		game.add_entity(new TemplateThing(50, 50));

		game.game_systems.user_input_service.start_level(game.game_systems.user_input_service.level_index);

		game.run_game(ctx, 60);
	});
}

window.addEventListener('load', main);
