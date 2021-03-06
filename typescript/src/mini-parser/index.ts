interface IRule {
  name: string | null | undefined;
  accept(input: string): { contain: boolean; group: IGroup };
}

interface IGroup {
  getName(): string | null | undefined;
  getSubGroups(): IGroup[];
  toRawString(): string;
}

class TreeGroup implements IGroup {
  protected constructor(private readonly groups: IGroup[], private readonly name: string | null | undefined = null) {}

  public static of(groups: IGroup[], name: string | null | undefined = null): IGroup {
    return new TreeGroup(groups, name);
  }

  public getSubGroups() {
    return this.groups;
  }

  public toRawString() {
    return this.groups.map((g) => g.toRawString()).join("");
  }

  public getName() {
    return this.name;
  }
}

class LeafGroup implements IGroup {
  protected constructor(private readonly text: string, private readonly name: string | null | undefined = null) {}

  public static of(text: string, name: string | null | undefined = null): IGroup {
    return new LeafGroup(text, name);
  }

  public getSubGroups() {
    return [];
  }

  public toRawString() {
    return this.text;
  }

  public getName() {
    return this.name;
  }
}

class TextRule implements IRule {
  protected constructor(private readonly text: string, public name: string | null | undefined = null) {}

  public static of(text: string, name: string | null | undefined = null): IRule {
    return new TextRule(text, name);
  }

  public accept(input: string) {
    return { contain: input.startsWith(this.text), group: LeafGroup.of(this.text, this.name) };
  }
}

class RegExpRule implements IRule {
  private readonly regExp: RegExp;

  protected constructor(regExp: string | RegExp, public readonly name: string | null | undefined = null) {
    this.regExp = new RegExp(regExp);
  }

  public static of(regExp: string | RegExp, name: string | null | undefined = null): IRule {
    return new RegExpRule(regExp, name);
  }

  public accept(input: string) {
    const regExpExecArray = this.regExp.exec(input);
    const contain = regExpExecArray ? regExpExecArray.index === 0 : false;
    const capturedText = regExpExecArray ? regExpExecArray[0] : "";
    return { contain, group: LeafGroup.of(capturedText, this.name) };
  }
}

class AndRule implements IRule {
  protected constructor(private readonly rules: IRule[], public readonly name: string | null | undefined = null) {}

  public static of(rules: IRule[], name: string | null | undefined = null) {
    return new AndRule(rules, name);
  }

  public accept(input: string) {
    let count = 0;
    let temp = input;
    const groups: IGroup[] = [];
    for (const rule of this.rules) {
      const { contain: _c, group: _g } = rule.accept(temp);
      if (_c) {
        groups.push(_g);
        temp = temp.replace(_g.toRawString(), "");
        count++;
      } else {
        break;
      }
    }
    const contain = count === this.rules.length;
    return { contain, group: TreeGroup.of(groups, this.name) };
  }
}

class OrRule implements IRule {
  protected constructor(private readonly rules: IRule[], public readonly name: string | null | undefined = null) {}

  public static of(rules: IRule[], name: string | null | undefined = null) {
    return new OrRule(rules, name);
  }

  public accept(input: string) {
    const groups: IGroup[] = [];
    let contain = false;
    for (const rule of this.rules) {
      const { contain: _c, group: _g } = rule.accept(input);
      if (_c) {
        contain = true;
        groups.push(_g);
        break;
      }
    }
    return { contain, group: TreeGroup.of(groups, this.name) };
  }
}

class TimesRule implements IRule {
  protected constructor(
    private readonly times: number,
    private readonly rule: IRule,
    public readonly name: string | null | undefined = null
  ) {}

  public static of(times: number, rule: IRule, name: string | null | undefined = null): IRule {
    return new TimesRule(times, rule, name);
  }

  public accept(input: string) {
    let temp = input;
    const groups: IGroup[] = [];
    let i = 0;
    for (; i < this.times; i++) {
      const { contain: _c, group: _g } = this.rule.accept(temp);
      if (_c) {
        groups.push(_g);
        temp = temp.replace(_g.toRawString(), "");
      } else {
        break;
      }
    }
    const contain = this.times <= i;
    return { contain, group: TreeGroup.of(groups, this.name) };
  }
}

class OneOrMoreRule implements IRule {
  protected constructor(private readonly rule: IRule, public readonly name: string | null | undefined = null) {}

  public static of(rule: IRule, name: string | null | undefined = null): IRule {
    return new OneOrMoreRule(rule, name);
  }

  public accept(input: string) {
    let temp = input;
    const groups: IGroup[] = [];
    let count = 0;
    for (; temp !== ""; count++) {
      const { contain: _c, group: _g } = this.rule.accept(temp);
      if (_c) {
        groups.push(_g);
        temp = temp.replace(_g.toRawString(), "");
      } else {
        break;
      }
    }
    const contain = count > 0;
    return { contain, group: TreeGroup.of(groups, this.name) };
  }
}

class ZeroOrMoreRule implements IRule {
  protected constructor(private readonly rule: IRule, public readonly name: string | null | undefined = null) {}

  public static of(rule: IRule, name: string | null | undefined = null): IRule {
    return new ZeroOrMoreRule(rule, name);
  }

  public accept(input: string) {
    let temp = input;
    const groups: IGroup[] = [];
    let count = 0;
    for (; temp !== ""; count++) {
      const { contain: _c, group: _g } = this.rule.accept(temp);
      if (_c) {
        groups.push(_g);
        temp = temp.replace(_g.toRawString(), "");
      } else {
        break;
      }
    }
    return { contain: true, group: TreeGroup.of(groups, this.name) };
  }
}

class AnyCharRule implements IRule {
  protected constructor(private readonly except: string, public readonly name: string | null | undefined = null) {}

  public static of(name: string | null | undefined = null) {
    return new AnyCharRule("", name);
  }

  public static except(text: string, name: string | null | undefined = null) {
    return new AnyCharRule(text, name);
  }

  public accept(input: string) {
    if (input.length && input[0] !== this.except) {
      return { contain: true, group: LeafGroup.of(input[0], this.name) };
    }
    return { contain: false, group: LeafGroup.of("", this.name) };
  }
}

const rule = ZeroOrMoreRule.of(
  OrRule.of(
    [
      AndRule.of(
        [
          TextRule.of("######"),
          OneOrMoreRule.of(TextRule.of(" ")),
          OneOrMoreRule.of(AnyCharRule.except("\n"), "CONTENT"),
          TextRule.of("\n"),
        ],
        "H6"
      ),
      AndRule.of(
        [
          TextRule.of("#####"),
          OneOrMoreRule.of(TextRule.of(" ")),
          OneOrMoreRule.of(AnyCharRule.except("\n"), "CONTENT"),
          TextRule.of("\n"),
        ],
        "H5"
      ),
      AndRule.of(
        [
          TextRule.of("####"),
          OneOrMoreRule.of(TextRule.of(" ")),
          OneOrMoreRule.of(AnyCharRule.except("\n"), "CONTENT"),
          TextRule.of("\n"),
        ],
        "H4"
      ),
      AndRule.of(
        [
          TextRule.of("###"),
          OneOrMoreRule.of(TextRule.of(" ")),
          OneOrMoreRule.of(AnyCharRule.except("\n"), "CONTENT"),
          TextRule.of("\n"),
        ],
        "H3"
      ),
      AndRule.of(
        [
          TextRule.of("##"),
          OneOrMoreRule.of(TextRule.of(" ")),
          OneOrMoreRule.of(AnyCharRule.except("\n"), "CONTENT"),
          TextRule.of("\n"),
        ],
        "H2"
      ),
      AndRule.of(
        [
          TextRule.of("#"),
          OneOrMoreRule.of(TextRule.of(" ")),
          OneOrMoreRule.of(AnyCharRule.except("\n"), "CONTENT"),
          TextRule.of("\n"),
        ],
        "H1"
      ),
      AndRule.of(
        [
          TextRule.of("-"),
          OneOrMoreRule.of(TextRule.of(" ")),
          OneOrMoreRule.of(AnyCharRule.except("\n"), "CONTENT"),
          TextRule.of("\n"),
        ],
        "LI"
      ),
      AndRule.of([OneOrMoreRule.of(AnyCharRule.except("\n"), "CONTENT"), TextRule.of("\n")], "P"),
    ],
    "MD_ELE"
  ),
  "MD_TOTAL"
);

const source = `# Hello
## World
### You
#### Are
##### A
###### Pig
- Hello
- World
hello, world!
`;

console.log(JSON.stringify(rule.accept(source)));
