import { template, insert, className } from '../../../vendor/solid-js/web/dist/web.js';
import { createMemo, createComponent, Show, For, createRenderEffect, Index, Switch, Match } from '../../../vendor/solid-js/dist/solid.js';
import ContextManager from '../../../ui/context-manager/context-manager.js';
import { Layout } from '../../../ui/utilities/utilities-layout.js';
import { Accordian } from '../../components/accordian.js';
import { Activatable } from '../../components/activatable.js';
import { AlternatingRows } from '../../components/alternating-rows.js';
import { Button } from '../../components/button.js';
import { Dropdown, DropdownItem } from '../../components/dropdown.js';
import { Frame } from '../../components/frame.js';
import { Header } from '../../components/header.js';
import { HeroButton2 } from '../../components/hero-button.js';
import { Hotkeys } from '../../components/hotkeys.js';
import { Icon } from '../../components/icon.js';
import { useGameSetupStringCacheContext } from '../../components/l10n-game-setup.js';
import { L10n } from '../../components/l10n.js';
import { NavHelp } from '../../components/nav-help.js';
import { usePopupContext } from '../../components/popup.js';
import { ScrollArea } from '../../components/scroll-area.js';
import { SelectorSmall } from '../../components/selector-small.js';
import { SpatialSlot } from '../../components/slot.js';
import { Tab } from '../../components/tab.js';
import { TextInput } from '../../components/text-input.js';
import { Tooltip, TooltipHorizontalPosition } from '../../components/tooltip.js';
import { AgeSelectModel } from './age-select-model.js';
import { AttributeIcon } from './attribute-icon.js';
import { CivSelectModel } from './civ-select-model.js';
import { PlayerSetupParametersModel, GameSetupParameterGroupsModel, SetupParametersModel } from './game-parameters-model.js';
import { LeaderSelectModel } from './leader-select-model.js';
import { TicketBox } from './ticket-box.js';
import { ComponentRegistry } from '../../services/component-registry.js';
import style from './advanced-options.scss.js';

Automation.log('[YnAMP] Loading ui-next create-game advanced-options replacement.');

var _tmpl$ = /* @__PURE__ */ template(`<div class="uppercase text-secondary-1 font-title mb-2 self-center"></div>`), _tmpl$2 = /* @__PURE__ */ template(`<div class="flex flex-row items-center justify-start mb-4 self-center"></div>`), _tmpl$3 = /* @__PURE__ */ template(`<div class="uppercase text-secondary-1 text-sm font-title"></div>`), _tmpl$4 = /* @__PURE__ */ template(`<div class="uppercase text-secondary-1 text-sm font-title flex items-center justify-center py-4"></div>`), _tmpl$5 = /* @__PURE__ */ template(`<div class="create-game-civ-card-icon flex items-center justify-center"></div>`), _tmpl$6 = /* @__PURE__ */ template(`<div class="uppercase ml-2 mr-4"></div>`), _tmpl$7 = /* @__PURE__ */ template(`<div class="uppercase text-secondary-1 text-sm font-title mt-4"></div>`), _tmpl$8 = /* @__PURE__ */ template(`<div class="flex flex-row mt-1 items-center"></div>`), _tmpl$9 = /* @__PURE__ */ template(`<div class="my-1 h-12 flex relative"><div class="absolute size-full flex group-focus\\:opacity-0 group-hover\\:opacity-0 group-pressed\\:opacity-0"><div class="advanced-options__dropdown-bg flex-auto -ml-1"></div><div class="advanced-options__dropdown-bg flex-auto -mr-1 -scale-x-100"></div></div><div class="absolute size-full flex opacity-0 group-focus\\:opacity-100 group-hover\\:opacity-100 group-pressed\\:opacity-100"><div class="advanced-options__dropdown-bg-highlight flex-auto -ml-1"></div><div class="advanced-options__dropdown-bg-highlight flex-auto -mr-1 -scale-x-100"></div></div><div class="advanced-options__settings-header-content flex items-center justify-center size-full relative pointer-events-auto"><div class="advanced-options__header-decor w-5 h-7 rotate-90"></div><div class="font-title my-1 uppercase mx-4 tracking-150"></div><div class="advanced-options__header-decor w-5 h-7 -rotate-90"></div></div></div>`), _tmpl$10 = /* @__PURE__ */ template(`<div class="flex flex-row items-center"></div>`), _tmpl$11 = /* @__PURE__ */ template(`<div class="flex flex-row mt-4"><div class=w-12></div><div class="flex flex-row flex-auto"><div class="m-2 flex-1 items-center justify-center uppercase font-title tracking-150 pointer-events-auto"role=columnheader></div><div class="m-2 flex-1 items-center justify-center uppercase font-title tracking-150 pointer-events-auto"role=columnheader></div></div><div class=w-14></div></div>`), _tmpl$12 = /* @__PURE__ */ template(`<div class="flex-auto flex flex-row justify-start items-center"><div class="advanced-options_add-player-plus bg-no-repeat bg-contain size-12 m-3"></div></div>`), _tmpl$13 = /* @__PURE__ */ template(`<div class="close-button__bg absolute inset-0"></div>`), _tmpl$14 = /* @__PURE__ */ template(`<div class="close-button__bg-hover absolute inset-0 opacity-0 group-hover\\:opacity-100 group-focus\\:opacity-100 transition-opacity"></div>`), _tmpl$15 = /* @__PURE__ */ template(`<div class="close-button__bg-pressed absolute inset-0 opacity-0 group-active\\:opacity-100 group-pressed\\:opacity-100"></div>`), _tmpl$16 = /* @__PURE__ */ template(`<div class="flex flex-row"><div class="w-12 flex items-center justify-start text-base font-title"></div><div class="flex flex-row flex-auto px-6"></div><div class=w-14></div></div>`), _tmpl$17 = /* @__PURE__ */ template(`<div class="flex flex-row"><div class="flex-auto flex flex-row items-center pl-4"></div><div class=w-96></div></div>`), _tmpl$18 = /* @__PURE__ */ template(`<div></div>`), _tmpl$19 = /* @__PURE__ */ template(`<div class="flex flex-col"></div>`), _tmpl$20 = /* @__PURE__ */ template(`<div class="flex flex-row w-full pr-8 mt-2 items-end justify-between relative"><div class="flex flex-row"></div><div class="flex flex-row items-center relative -right-8"><div class="filigree-h4-left mt-3"></div><div class="filigree-h4-right mt-3"></div></div></div>`), _tmpl$21 = /* @__PURE__ */ template(`<div class="fullscreen flex flex-col"></div>`);
const RANDOM_PLAYER_OPTION_VALUE = {
  value: "RANDOM",
  name: "LOC_CIVILIZATION_RANDOM_NAME"
};
const RANDOM_PLAYER_OPTION = {
  value: RANDOM_PLAYER_OPTION_VALUE,
  domain: {
    possibleValues: []
  },
  setValue: () => {
  }
};
const LeaderTooltip = (props) => {
  const leaderSelectModel = LeaderSelectModel.get();
  const leaderType = createMemo(() => props.data.value);
  const leader = createMemo(() => leaderSelectModel.leaders.find((leader2) => leader2.leaderID == leaderType()));
  const isRandom = createMemo(() => leaderType() == "RANDOM");
  return createComponent(Tooltip.Frame, {
    "class": "flex flex-col relative max-w-128",
    get children() {
      return [createComponent(Show, {
        get when() {
          return !isRandom();
        },
        get children() {
          var _el$ = _tmpl$();
          insert(_el$, createComponent(L10n.Compose, {
            get text() {
              return leader()?.name;
            }
          }));
          return _el$;
        }
      }), (() => {
        var _el$2 = _tmpl$2();
        insert(_el$2, createComponent(For, {
          get each() {
            return leader()?.tags;
          },
          children: (attribute) => [(() => {
            var _el$5 = _tmpl$5();
            insert(_el$5, createComponent(AttributeIcon, {
              "class": "size-8",
              attribute
            }));
            return _el$5;
          })(), (() => {
            var _el$6 = _tmpl$6();
            insert(_el$6, createComponent(L10n.Compose, {
              text: attribute
            }));
            return _el$6;
          })()]
        }));
        return _el$2;
      })(), createComponent(Show, {
        get when() {
          return !isRandom();
        },
        get children() {
          return createComponent(TicketBox, {
            "class": "px-6 pt-4 pb-6",
            get children() {
              return [(() => {
                var _el$3 = _tmpl$3();
                insert(_el$3, createComponent(L10n.Compose, {
                  get text() {
                    return leader()?.abilityTitle ?? "";
                  }
                }));
                return _el$3;
              })(), createComponent(L10n.Stylize, {
                "class": "create-game-markup mt-2",
                get text() {
                  return leader()?.abilityTextTag;
                }
              })];
            }
          });
        }
      }), createComponent(Show, {
        get when() {
          return isRandom();
        },
        get children() {
          return createComponent(TicketBox, {
            get children() {
              var _el$4 = _tmpl$4();
              insert(_el$4, createComponent(L10n.Compose, {
                text: "LOC_LEADER_RANDOM_NAME"
              }));
              return _el$4;
            }
          });
        }
      })];
    }
  });
};
const CivTooltip = (props) => {
  const civSelectModel = CivSelectModel.get();
  const ageSelectModel = AgeSelectModel.get();
  const age = ageSelectModel.selectedAge;
  const civType = createMemo(() => props.data.value);
  const civilization = createMemo(() => civSelectModel.civs.find((civ) => civ.civID == civType()));
  const activeAbility = createMemo(() => civilization()?.perAgeAbilities.find((a) => a.age == age.type) ?? civilization()?.perAgeAbilities.find((a) => !a.age));
  const isRandom = createMemo(() => civType() == "RANDOM");
  return createComponent(Tooltip.Frame, {
    "class": "flex flex-col relative max-w-128",
    get children() {
      return [createComponent(Show, {
        get when() {
          return !isRandom();
        },
        get children() {
          var _el$7 = _tmpl$();
          insert(_el$7, createComponent(L10n.Compose, {
            get text() {
              return civilization()?.name;
            }
          }));
          return _el$7;
        }
      }), (() => {
        var _el$8 = _tmpl$2();
        insert(_el$8, createComponent(For, {
          get each() {
            return civilization()?.traits;
          },
          children: (attribute) => [(() => {
            var _el$12 = _tmpl$5();
            insert(_el$12, createComponent(AttributeIcon, {
              "class": "size-8",
              attribute
            }));
            return _el$12;
          })(), (() => {
            var _el$13 = _tmpl$6();
            insert(_el$13, createComponent(L10n.Compose, {
              text: attribute
            }));
            return _el$13;
          })()]
        }));
        return _el$8;
      })(), createComponent(Show, {
        get when() {
          return !isRandom();
        },
        get children() {
          return createComponent(TicketBox, {
            "class": "px-6 pt-4 pb-6",
            get children() {
              return [(() => {
                var _el$9 = _tmpl$3();
                insert(_el$9, createComponent(L10n.Compose, {
                  get text() {
                    return activeAbility()?.abilityTitle ?? "";
                  }
                }));
                return _el$9;
              })(), createComponent(L10n.Stylize, {
                "class": "create-game-markup tight mt-2",
                get text() {
                  return activeAbility()?.abilityText ?? "";
                }
              }), (() => {
                var _el$10 = _tmpl$7();
                insert(_el$10, createComponent(L10n.Compose, {
                  text: "LOC_CREATE_CIV_UNIQUE_BONUSES_SUBTITLE"
                }));
                return _el$10;
              })(), createComponent(For, {
                get each() {
                  return civilization()?.buildings;
                },
                children: (building) => (() => {
                  var _el$14 = _tmpl$8();
                  insert(_el$14, createComponent(Icon, {
                    "class": "size-8 mr-2",
                    get name() {
                      return building.icon;
                    }
                  }), null);
                  insert(_el$14, createComponent(L10n.Compose, {
                    get text() {
                      return building.title;
                    }
                  }), null);
                  return _el$14;
                })()
              }), createComponent(For, {
                get each() {
                  return civilization()?.units;
                },
                children: (unit) => (() => {
                  var _el$15 = _tmpl$8();
                  insert(_el$15, createComponent(Icon, {
                    "class": "size-8 mr-2",
                    get name() {
                      return unit.icon;
                    }
                  }), null);
                  insert(_el$15, createComponent(L10n.Compose, {
                    get text() {
                      return unit.title;
                    }
                  }), null);
                  return _el$15;
                })()
              })];
            }
          });
        }
      }), createComponent(Show, {
        get when() {
          return isRandom();
        },
        get children() {
          return createComponent(TicketBox, {
            get children() {
              var _el$11 = _tmpl$4();
              insert(_el$11, createComponent(L10n.Compose, {
                text: "LOC_CIVILIZATION_RANDOM_NAME"
              }));
              return _el$11;
            }
          });
        }
      })];
    }
  });
};
const AdvancedOptionsAccordian = (props) => {
  return createComponent(Accordian, {
    get header() {
      return (() => {
        var _el$16 = _tmpl$9(), _el$17 = _el$16.firstChild, _el$18 = _el$17.nextSibling, _el$19 = _el$18.nextSibling, _el$20 = _el$19.firstChild, _el$21 = _el$20.nextSibling;
        insert(_el$21, createComponent(L10n.Compose, {
          get text() {
            return props.title;
          }
        }));
        return _el$16;
      })();
    },
    get children() {
      return props.children;
    }
  });
};
const AdvancedOptionPlayerOption = (props) => {
  return (() => {
    var _el$22 = _tmpl$10();
    insert(_el$22, createComponent(Icon, {
      get ["class"]() {
        return props.param.value == "RANDOM" ? "size-8 mr-3 ml-2" : "size-12 mr-1";
      },
      get name() {
        return props.param.value == "RANDOM" ? "LEADER_RANDOM" : props.param.value;
      }
    }), null);
    insert(_el$22, createComponent(L10n.Stylize, {
      get text() {
        return GameSetup.resolveString(props.param.name) ?? "";
      }
    }), null);
    return _el$22;
  })();
};
const AdvancedOptionsPlayerSetup = () => {
  const playerOptions = PlayerSetupParametersModel.get().players;
  const slots = PlayerSetupParametersModel.get().configuration;
  const hasOpenSlots = createMemo(() => slots.openSlots().length > 0);
  function closeSlot(slot) {
    if (slots.activeSlots().length <= 2) return;
    slot.setSlotStatus(SlotStatus.SS_CLOSED);
  }
  function openSlot() {
    if (hasOpenSlots()) {
      slots.openSlots()[0].setSlotStatus(SlotStatus.SS_COMPUTER);
      slots.reload();
    }
  }
  function getPlayerOptionSet(slot) {
    return playerOptions[slot.playerId];
  }
  function isPlayerOptionReady(playerOption) {
    return !!playerOption && (playerOption.domain?.possibleValues?.length ?? 0) > 0;
  }
  function getCiv(slot) {
    const playerCiv = getPlayerOptionSet(slot)?.PlayerCivilization;
    return isPlayerOptionReady(playerCiv) ? playerCiv : RANDOM_PLAYER_OPTION;
  }
  function getLeader(slot) {
    const playerLeader = getPlayerOptionSet(slot)?.PlayerLeader;
    return isPlayerOptionReady(playerLeader) ? playerLeader : RANDOM_PLAYER_OPTION;
  }
  function isCivReady(slot) {
    return isPlayerOptionReady(getPlayerOptionSet(slot)?.PlayerCivilization);
  }
  function isLeaderReady(slot) {
    return isPlayerOptionReady(getPlayerOptionSet(slot)?.PlayerLeader);
  }
  function sortPossibleValues(possibleValues) {
    if (!possibleValues) return;
    return [...possibleValues].sort((a, b) => {
      if (a.sortIndex != b.sortIndex) return a.sortIndex - b.sortIndex;
      const nameA = Locale.compose(GameSetup.resolveString(a.name));
      const nameB = Locale.compose(GameSetup.resolveString(b.name));
      return Locale.compare(nameA, nameB);
    });
  }
  return createComponent(ScrollArea, {
    "class": "flex-auto",
    get children() {
      return createComponent(SpatialSlot, {
        name: "advanced-player-options-slot",
        "class": "flex flex-col flex-auto w-full pr-8",
        get children() {
          return [(() => {
            var _el$23 = _tmpl$11(), _el$24 = _el$23.firstChild, _el$25 = _el$24.nextSibling, _el$26 = _el$25.firstChild, _el$27 = _el$26.nextSibling;
            insert(_el$26, createComponent(L10n.Compose, {
              text: "LOC_GENERIC_LEADER"
            }));
            insert(_el$27, createComponent(L10n.Compose, {
              text: "LOC_GENERIC_CIVILIZATION"
            }));
            return _el$23;
          })(), createComponent(For, {
            get each() {
              return slots.activeSlots();
            },
            children: (slot, slotNum) => (() => {
              var _el$30 = _tmpl$16(), _el$31 = _el$30.firstChild, _el$32 = _el$31.nextSibling, _el$33 = _el$32.nextSibling;
              insert(_el$31, () => slotNum() + 1);
              insert(_el$32, createComponent(Dropdown, {
                "class": "my-2 mr-2 w-1\\/2",
                get disabled() {
                  return !isLeaderReady(slot);
                },
                get defaultValue() {
                  return getLeader(slot).value;
                },
                selectedItemTemplate: (leader) => createComponent(Tooltip, {
                  get initialHPosition() {
                    return TooltipHorizontalPosition.RIGHT;
                  },
                  get children() {
                    return [createComponent(Tooltip.Trigger, {
                      get children() {
                        return createComponent(AdvancedOptionPlayerOption, {
                          param: leader
                        });
                      }
                    }), createComponent(Tooltip.Content, {
                      get children() {
                        return createComponent(LeaderTooltip, {
                          data: leader
                        });
                      }
                    })];
                  }
                }),
                onItemSelected: (value) => getLeader(slot).setValue(value.value),
                get children() {
                  return createComponent(For, {
                    get each() {
                      return sortPossibleValues(getLeader(slot).domain.possibleValues);
                    },
                    children: (leader) => createComponent(Tooltip, {
                      get initialHPosition() {
                        return TooltipHorizontalPosition.RIGHT;
                      },
                      get children() {
                        return [createComponent(Tooltip.Trigger, {
                          get children() {
                            return createComponent(DropdownItem, {
                              value: leader,
                              get children() {
                                return createComponent(AdvancedOptionPlayerOption, {
                                  param: leader
                                });
                              }
                            });
                          }
                        }), createComponent(Tooltip.Content, {
                          get children() {
                            return createComponent(LeaderTooltip, {
                              data: leader
                            });
                          }
                        })];
                      }
                    })
                  });
                }
              }), null);
              insert(_el$32, createComponent(Dropdown, {
                "class": "my-2 ml-2 w-1\\/2",
                get disabled() {
                  return !isCivReady(slot);
                },
                get defaultValue() {
                  return getCiv(slot).value;
                },
                selectedItemTemplate: (civ) => createComponent(Tooltip, {
                  get initialHPosition() {
                    return TooltipHorizontalPosition.LEFT;
                  },
                  get children() {
                    return [createComponent(Tooltip.Trigger, {
                      get children() {
                        return createComponent(AdvancedOptionPlayerOption, {
                          param: civ
                        });
                      }
                    }), createComponent(Tooltip.Content, {
                      get children() {
                        return createComponent(CivTooltip, {
                          data: civ
                        });
                      }
                    })];
                  }
                }),
                onItemSelected: (value) => getCiv(slot).setValue(value.value),
                get children() {
                  return createComponent(For, {
                    get each() {
                      return sortPossibleValues(getCiv(slot).domain.possibleValues);
                    },
                    children: (civ) => createComponent(Tooltip, {
                      get initialHPosition() {
                        return TooltipHorizontalPosition.LEFT;
                      },
                      get children() {
                        return [createComponent(Tooltip.Trigger, {
                          get children() {
                            return createComponent(DropdownItem, {
                              value: civ,
                              get children() {
                                return createComponent(AdvancedOptionPlayerOption, {
                                  param: civ
                                });
                              }
                            });
                          }
                        }), createComponent(Tooltip.Content, {
                          get children() {
                            return createComponent(CivTooltip, {
                              data: civ
                            });
                          }
                        })];
                      }
                    })
                  });
                }
              }), null);
              insert(_el$33, createComponent(Show, {
                get when() {
                  return !slot.isLocalPlayer;
                },
                get children() {
                  return createComponent(Activatable, {
                    audio: {
                      onPress: "data-audio-primary-button-press",
                      onFocus: "data-audio-primary-button-focus"
                    },
                    "class": `m-2 size-12 cursor-pointer group relative`,
                    onActivate: () => closeSlot(slot),
                    get children() {
                      return [_tmpl$13(), _tmpl$14(), _tmpl$15()];
                    }
                  });
                }
              }));
              return _el$30;
            })()
          }), createComponent(Button, {
            "class": "mt-4 my-10",
            onActivate: openSlot,
            get disabled() {
              return !hasOpenSlots();
            },
            get children() {
              var _el$28 = _tmpl$12(), _el$29 = _el$28.firstChild;
              insert(_el$28, createComponent(L10n.Compose, {
                text: "LOC_ADVANCED_OPTIONS_ADD_PLAYER"
              }), null);
              createRenderEffect(() => _el$29.classList.toggle("opacity-50", !hasOpenSlots()));
              return _el$28;
            }
          })];
        }
      });
    }
  });
};
const AdvancedOptionsParameterRow = (props) => {
  return (() => {
    var _el$37 = _tmpl$17(), _el$38 = _el$37.firstChild, _el$39 = _el$38.nextSibling;
    insert(_el$38, createComponent(L10n.Compose, {
      get text() {
        return props.rowName;
      }
    }));
    insert(_el$39, () => props.children);
    return _el$37;
  })();
};
const strInvertSelection = GameSetup.makeString("InvertSelection");
const AdvancedOptionMultiselectField = (props) => {
  const stringCache = useGameSetupStringCacheContext();
  const isInverted = createMemo(() => props.parameter.uxHint == strInvertSelection);
  const valueItems = createMemo(() => [{
    name: "LOC_UI_ENABLED",
    value: !isInverted(),
    description: "LOC_UI_ENABLED"
  }, {
    name: "LOC_UI_DISABLED",
    value: isInverted(),
    description: "LOC_UI_DISABLED"
  }]);
  function hasValue(value) {
    return !!props.parameter.values.find((v) => v.value == value);
  }
  function setValue(value, isIncluded) {
    const newValues = [...props.parameter.values.map((v) => v.value)];
    const valueIndex = newValues.findIndex((v) => v == value.value);
    if (isIncluded) {
      if (valueIndex == -1) {
        newValues.push(value.value);
      }
    } else {
      if (valueIndex >= 0) {
        newValues.splice(valueIndex, 1);
      }
    }
    props.parameter.setValue(newValues);
  }
  function getRowClass(index) {
    return index % 2 == 0 ? "bg-primary-4" : "bg-primary-5";
  }
  return createComponent(AdvancedOptionsAccordian, {
    get title() {
      return stringCache.resolve(props.parameter.name);
    },
    get children() {
      return createComponent(Index, {
        get each() {
          return props.parameter.domain.possibleValues ?? [];
        },
        children: (domainValue, index) => (() => {
          var _el$40 = _tmpl$18();
          insert(_el$40, createComponent(AdvancedOptionsParameterRow, {
            get rowName() {
              return stringCache.resolve(domainValue().name);
            },
            get children() {
              return createComponent(SelectorSmall, {
                "class": "m-1",
                get items() {
                  return valueItems();
                },
                setSelectedValue: (value) => setValue(domainValue(), value),
                selectedValue: () => hasValue(domainValue().value),
                previousActionKey: "nav-left",
                nextActionKey: "nav-right"
              });
            }
          }));
          createRenderEffect(() => className(_el$40, getRowClass(index)));
          return _el$40;
        })()
      });
    }
  });
};
const AdvancedOptionBooleanField = (props) => {
  const isInverted = createMemo(() => props.parameter.uxHint == strInvertSelection);
  const valueItems = createMemo(() => [{
    name: "LOC_UI_ENABLED",
    value: !isInverted(),
    description: "LOC_UI_ENABLED"
  }, {
    name: "LOC_UI_DISABLED",
    value: isInverted(),
    description: "LOC_UI_DISABLED"
  }]);
  return createComponent(SelectorSmall, {
    "class": "m-1",
    get items() {
      return valueItems();
    },
    setSelectedValue: (value) => props.parameter.setValue(value),
    selectedValue: () => props.parameter.value.value,
    previousActionKey: "nav-left",
    nextActionKey: "nav-right"
  });
};
const AdvancedOptionSelectorField = (props) => {
  const stringCache = useGameSetupStringCacheContext();
  function extractSelectorValues(values) {
    return values.map((v) => ({
      name: stringCache.resolve(v.name),
      value: v.value,
      description: stringCache.resolve(v.description)
    }));
  }
  function isParameterValid(param) {
    return typeof param == "object" && !param.hidden && !param.destroyed && (param.domain.type != GameSetupDomainType.Select || (param.domain.possibleValues?.length ?? 0) > 1) && param.invalidReason == GameSetupParameterInvalidReason.Valid;
  }
  return createComponent(SelectorSmall, {
    "class": "m-1",
    get items() {
      return extractSelectorValues(props.parameter.domain.possibleValues ?? []);
    },
    setSelectedValue: (value) => props.parameter.setValue(value),
    selectedValue: () => props.parameter.value.value,
    get disabled() {
      return !isParameterValid(props.parameter);
    },
    previousActionKey: "nav-left",
    nextActionKey: "nav-right"
  });
};
const AdvancedOptionTextField = (props) => {
  const value = createMemo(() => (props.parameter.value.value ?? "").toString());
  const maxNumericValue = Math.pow(2, 31);
  function setValue(value) {
    if (props.parameter.domain.type == GameSetupDomainType.Integer || props.parameter.domain.type == GameSetupDomainType.UnsignedInteger) {
      const numericValue = Number.parseInt(value);
      if (numericValue) {
        const clampedNumericValue = Math.min(Math.max(numericValue, -1 * maxNumericValue), maxNumericValue - 1);
        props.parameter.setValue(clampedNumericValue);
        return clampedNumericValue.toString();
      }
    } else {
      props.parameter.setValue(value);
    }
    return value;
  }
  return createComponent(TextInput, {
    "class": "w-72 m-1",
    setValue,
    value,
    tabIndex: -1
  });
};
const AdvancedReadonlyTextField = (props) => {
  const value = createMemo(() => (props.parameter.value.value ?? "").toString());
  return createMemo(value);
};
const AdvancedOptionField = (props) => {
  const stringCache = useGameSetupStringCacheContext();
  return createComponent(Switch, {
    get children() {
      return [createComponent(Match, {
        get when() {
          return props.parameter.readOnly;
        },
        get children() {
          return createComponent(AdvancedOptionsParameterRow, {
            get rowName() {
              return stringCache.resolve(props.parameter.name);
            },
            get children() {
              return createComponent(AdvancedReadonlyTextField, {
                get parameter() {
                  return props.parameter;
                }
              });
            }
          });
        }
      }), createComponent(Match, {
        get when() {
          return props.parameter.domain.type == GameSetupDomainType.Select && props.parameter.array;
        },
        get children() {
          return createComponent(AdvancedOptionMultiselectField, {
            get parameter() {
              return props.parameter;
            }
          });
        }
      }), createComponent(Match, {
        get when() {
          return props.parameter.domain.type == GameSetupDomainType.Select;
        },
        get children() {
          return createComponent(AdvancedOptionsParameterRow, {
            get rowName() {
              return stringCache.resolve(props.parameter.name);
            },
            get children() {
              return createComponent(AdvancedOptionSelectorField, {
                get parameter() {
                  return props.parameter;
                }
              });
            }
          });
        }
      }), createComponent(Match, {
        get when() {
          return props.parameter.domain.type == GameSetupDomainType.Boolean;
        },
        get children() {
          return createComponent(AdvancedOptionsParameterRow, {
            get rowName() {
              return stringCache.resolve(props.parameter.name);
            },
            get children() {
              return createComponent(AdvancedOptionBooleanField, {
                get parameter() {
                  return props.parameter;
                }
              });
            }
          });
        }
      }), createComponent(Match, {
        get when() {
          return props.parameter.domain.type == GameSetupDomainType.Integer || props.parameter.domain.type == GameSetupDomainType.UnsignedInteger || props.parameter.domain.type == GameSetupDomainType.Text;
        },
        get children() {
          return createComponent(AdvancedOptionsParameterRow, {
            get rowName() {
              return stringCache.resolve(props.parameter.name);
            },
            get children() {
              return createComponent(AdvancedOptionTextField, {
                get parameter() {
                  return props.parameter;
                }
              });
            }
          });
        }
      })];
    }
  });
};
const AdvancedOptionsGameSetup = () => {
  const model = GameSetupParameterGroupsModel.get();
  return createComponent(ScrollArea, {
    "class": "flex-auto",
    get children() {
      return createComponent(SpatialSlot, {
        name: "advanced-options-game-setup-slot",
        "class": "flex flex-col",
        get children() {
          return createComponent(For, {
            get each() {
              return Object.entries(model.groups);
            },
            children: ([groupId, parameters]) => {
              const parameterList = Object.values(parameters).filter((param) => typeof param == "object" && !param.hidden && !param.destroyed && (param.domain.type != GameSetupDomainType.Select || (param.domain.possibleValues?.length ?? 0) > 0) && param.invalidReason == GameSetupParameterInvalidReason.Valid);
              return parameterList.length > 0 ? (() => {
                var _el$41 = _tmpl$19();
                insert(_el$41, createComponent(AdvancedOptionsAccordian, {
                  get title() {
                    return model.groupNames.get(groupId) ?? groupId;
                  },
                  get children() {
                    return createComponent(AlternatingRows, {
                      each: parameterList,
                      children: (parameter) => createComponent(AdvancedOptionField, {
                        parameter
                      })
                    });
                  }
                }));
                return _el$41;
              })() : void 0;
            }
          });
        }
      });
    }
  });
};
const AdvancedOptionsScreenComponent = () => {
  const parametersModel = SetupParametersModel.get();
  const popupContext = usePopupContext();
  const gameConfig = Configuration.getGame();
  let saveType = SaveTypes.SINGLE_PLAYER;
  if (gameConfig.isHotseat) {
    saveType = SaveTypes.HOTSEAT;
  } else if (gameConfig.isInternetMultiplayer) {
    saveType = SaveTypes.NETWORK_MULTIPLAYER;
  }
  function showSaveScreen() {
    ContextManager.push("screen-save-load", {
      singleton: true,
      createMouseGuard: true,
      attributes: {
        "menu-type": "save_config",
        "server-type": ServerType.SERVER_TYPE_NONE,
        "save-type": saveType
      }
    });
  }
  function showLoadScreen() {
    ContextManager.push("screen-save-load", {
      singleton: true,
      createMouseGuard: true,
      attributes: {
        "menu-type": "load_config",
        "server-type": ServerType.SERVER_TYPE_NONE,
        "save-type": saveType
      }
    });
  }
  return (() => {
    var _el$42 = _tmpl$21();
    insert(_el$42, createComponent(Hotkeys, {
      hotkeys: [{
        hotkeyAction: "cancel",
        onActivate: () => popupContext.close("advanced-options")
      }]
    }), null);
    insert(_el$42, createComponent(Frame.F1, {
      contentClass: "px-22 pointer-events-auto",
      get style() {
        return {
          "max-width": Layout.pixels(1280)
        };
      },
      get children() {
        return [createComponent(Header, {
          "class": "mb-4 text-center",
          get children() {
            return createComponent(L10n.Compose, {
              text: "LOC_ADVANCED_OPTIONS_ADVANCED"
            });
          }
        }), createComponent(Tab, {
          "class": "flex-auto flex flex-col",
          defaultTab: "advanced-options-general",
          get children() {
            return [createComponent(Tab.TabList, {
              "class": "w-full my-2"
            }), createComponent(Tab.Output, {}), createComponent(Tab.Item, {
              name: "advanced-options-general",
              title: () => "LOC_ADVANCED_OPTIONS_GAME_SETTINGS",
              body: () => createComponent(AdvancedOptionsGameSetup, {})
            }), createComponent(Tab.Item, {
              name: "advanced-options-player",
              title: () => createComponent(L10n.Compose, {
                text: "LOC_ADVANCED_OPTIONS_PLAYER_SETTINGS"
              }),
              body: () => createComponent(AdvancedOptionsPlayerSetup, {})
            })];
          }
        }), (() => {
          var _el$43 = _tmpl$20(), _el$44 = _el$43.firstChild, _el$45 = _el$44.nextSibling, _el$46 = _el$45.firstChild, _el$47 = _el$46.nextSibling;
          insert(_el$44, createComponent(Button, {
            "class": "uppercase mr-2 relative",
            disableFocus: true,
            hotkeyAction: "shell-action-3",
            get onActivate() {
              return parametersModel.resetToDefaults;
            },
            get children() {
              return [createComponent(L10n.Compose, {
                text: "LOC_OPTIONS_RESET_TO_DEFAULTS"
              }), createComponent(NavHelp, {
                "class": "ml-2"
              })];
            }
          }), null);
          insert(_el$44, createComponent(Tooltip.Text, {
            get text() {
              return Locale.stylize("LOC_SAVE_LOAD_TITLE_SAVE_CONFIG");
            },
            get children() {
              return createComponent(Activatable, {
                "class": "advanced-options-save-button mx-2 size-12 bg-no-repeat bg-contain relative",
                disableFocus: true,
                hotkeyAction: "nav-shell-previous",
                onActivate: showSaveScreen,
                get children() {
                  return createComponent(NavHelp, {
                    "class": "absolute -bottom-6 left-2"
                  });
                }
              });
            }
          }), null);
          insert(_el$44, createComponent(Tooltip.Text, {
            get text() {
              return Locale.stylize("LOC_SAVE_LOAD_TITLE_LOAD_CONFIG");
            },
            get children() {
              return createComponent(Activatable, {
                "class": "advanced-options-load-button mx-2 size-12 bg-no-repeat bg-contain relative",
                disableFocus: true,
                hotkeyAction: "nav-shell-next",
                onActivate: showLoadScreen,
                get children() {
                  return createComponent(NavHelp, {
                    "class": "absolute -bottom-6 left-2"
                  });
                }
              });
            }
          }), null);
          insert(_el$45, createComponent(HeroButton2, {
            "class": "px-4 py-4 relative",
            disableFocus: true,
            hotkeyAction: "shell-action-1",
            onActivate: () => popupContext.close("advanced-options"),
            get children() {
              return [createComponent(L10n.Compose, {
                text: "LOC_GENERIC_CONFIRM"
              }), createComponent(NavHelp, {
                "class": "ml-2"
              })];
            }
          }), _el$47);
          return _el$43;
        })()];
      }
    }), null);
    return _el$42;
  })();
};
const AdvancedOptionsScreen = ComponentRegistry.register({
  name: "AdvancedOptionsScreen",
  createInstance: AdvancedOptionsScreenComponent,
  styles: [style]
});

export { AdvancedOptionsParameterRow, AdvancedOptionsScreen };