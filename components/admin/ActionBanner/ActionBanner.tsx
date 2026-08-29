import styles from "./ActionBanner.module.css"
import clsx from "clsx";
import { isValidElement } from "react";
import Button from "@/components/ui/Button";

type Color = "red" | "amber" | "green" | "blue";

type ByStarted<T> = { started: T; notStarted: T };

function byStartedShape<T>(value: T | ByStarted<T>): value is ByStarted<T> {
	return (
		typeof value === "object" &&
		value !== null &&
		!isValidElement(value) &&
		"started" in value &&
		"notStarted" in value
	);
}

function resolve<T>(value: T | ByStarted<T>, started: boolean): T {
	return byStartedShape(value) ? (started ? value.started : value.notStarted) : value;
}

type HandledAction = (formData: FormData) => void

type Participant = {
	id: string | number;
	name: string;
};

type ActionBannerProps = {
	started: boolean;
	participant: Participant;
	slug: string;
	color: Color;
	description?: React.ReactNode | ByStarted<React.ReactNode>;
	action: HandledAction | ByStarted<HandledAction>;
	close: (event?: React.SyntheticEvent) => void;
	inputData?: React.InputHTMLAttributes<HTMLInputElement>
};

export function ActionBanner(props: ActionBannerProps) {
	const {
		started,
		participant,
		slug,
		description,
		action,
		color,
		close,
		inputData
	} = props

	const resolvedAction = (formData: FormData) => resolve(action, started)(formData)

	return (
		<div className={clsx(styles["action-banner"], styles[`action-banner--${color}`])}>
			<span className={styles["action-banner__text"]}>{resolve(description, started)}</span>
			<form
				action={resolvedAction}
				onSubmit={close}
				className={styles["action-banner__form"]}
			>
				<input type="hidden" name="slug" value={slug} />
				<input type="hidden" name="participantId" value={participant.id} />
				{inputData ? <input required {...inputData} /> : null}
				<Button variant="quiet" type="button" onClick={() => close()}>
					Cancel
				</Button>
				<Button variant={color === "red" ? "danger" : "solid"} type="submit">
					Confirm
				</Button>
			</form>
		</div>
	);
}

export default ActionBanner;
