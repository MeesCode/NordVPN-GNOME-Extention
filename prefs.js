const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Data = Me.imports.data;
const countries = Data.countries;

const Gettext = imports.gettext;
const _ = Gettext.domain('nordvpn-status').gettext;

const Fields = {
	REFRESH_INTERVAL: 'refresh-interval',
	DEFAULT_COUNTRY: 'default-country',
};

const SCHEMA_NAME = 'org.gnome.shell.extensions.nordvpn-status';

const getSchema = function () {
	let schemaDir = Me.dir.get_child('schemas').get_path();
	let schemaSource = Gio.SettingsSchemaSource.new_from_directory(schemaDir, Gio.SettingsSchemaSource.get_default(), false);
	let schema = schemaSource.lookup(SCHEMA_NAME, false);

	return new Gio.Settings({ settings_schema: schema });
};

const SettingsSchema = getSchema();


function init() {
	let localeDir = Me.dir.get_child('locale');
	if (localeDir.query_exists(null))
		Gettext.bindtextdomain('nordvpn-status', localeDir.get_path());
}

const App = new Lang.Class({
	Name: 'NordVPN status settings',
	_init: function() {
	  this.main = new Gtk.Grid({
			margin: 10,
			row_spacing: 12,
			column_spacing: 18,
			column_homogeneous: false,
			row_homogeneous: false
		});
		this.field_interval = new Gtk.SpinButton({
			adjustment: new Gtk.Adjustment({
				lower: 1,
				upper: 3600,
				step_increment: 1
			})
		});

		this.field_default_country = new Gtk.ComboBox({
			model: this._create_country_options()});

		let rendererText = new Gtk.CellRendererText();
		this.field_default_country.pack_start (rendererText, false);
		this.field_default_country.add_attribute (rendererText, "text", 0);

		let intervalLabel     = new Gtk.Label({
			label: _("Refresh Interval (s)"),
			hexpand: true,
			halign: Gtk.Align.START
		});
		let countryLabel = new Gtk.Label({
			label: _("Default country"),
			hexpand: true,
			halign: Gtk.Align.START
		});

		this.main.attach(intervalLabel, 2, 1, 2 ,1);
		this.main.attach(countryLabel, 2, 2, 2 ,1);

		this.main.attach(this.field_interval, 4, 1, 2, 1);
		this.main.attach(this.field_default_country, 4, 2, 2, 1);

		SettingsSchema.bind(Fields.REFRESH_INTERVAL, this.field_interval, 'value', Gio.SettingsBindFlags.DEFAULT);
		SettingsSchema.bind(Fields.DEFAULT_COUNTRY, this.field_default_country, 'active', Gio.SettingsBindFlags.DEFAULT);

		this.main.show_all();
	},

	_create_country_options : function(){
		let options = countries;
		let liststore = new Gtk.ListStore();
		liststore.set_column_types([GObject.TYPE_STRING])
		for (let i = 0; i < options.length; i++ ) {
			let option = { name: _(options[i]) }
			let iter = liststore.append();
			liststore.set (iter, [0], [option.name]);
		}
		return liststore;
	}
});

function buildPrefsWidget(){
	let widget = new App();
	return widget.main;
}