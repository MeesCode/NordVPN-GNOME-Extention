const Lang = imports.lang;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;

const TimeButton = new Lang.Class({
    Name: "TimeButton",
    Extends: PanelMenu.Button,

    _init: function () {
        this.parent(null, "TimeButton");

        // Icon
        this.icon = new St.Icon({
            icon_name: "appointment-symbolic",
            style_class: "system-status-icon"
        });
        this.actor.add_actor(this.icon);

        // Menu
        this.menuItem = new PopupMenu.PopupMenuItem("Salah Time", {});
        this.menu.addMenuItem(this.menuItem);
    }
});

function init() {
}

function enable() {
    let indicator = new TimeButton();
    Main.panel.addToStatusArea("should-be-a-unique-string", indicator);

    // hide
    Main.panel.statusArea["should-be-a-unique-string"].actor.visible = false;

    // change icon
    Main.panel.statusArea["should-be-a-unique-string"].icon.icon_name = "appointment-soon-symbolic";

    // show
    Main.panel.statusArea["should-be-a-unique-string"].actor.visible = true;
}

function disable() {
    // you could also track "indicator" and just call indicator.destroy()
    Main.panel.statusArea["should-be-a-unique-string"].destroy();
}