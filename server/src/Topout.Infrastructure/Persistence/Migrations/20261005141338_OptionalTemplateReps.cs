using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Topout.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class OptionalTemplateReps : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "TargetRepsMin",
                table: "WorkoutDaySets",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer"
            );

            migrationBuilder.AddColumn<bool>(
                name: "IsSplit",
                table: "WorkoutDaySets",
                type: "boolean",
                nullable: false,
                defaultValue: false
            );
            migrationBuilder.Sql(
                "UPDATE \"WorkoutDaySets\" SET \"IsSplit\" = TRUE WHERE \"RightTargetRepsMin\" IS NOT NULL"
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Do not silently replace optional targets with invalid zero reps on rollback.
            migrationBuilder.Sql(
                """
                DO $$ BEGIN
                  IF EXISTS (SELECT 1 FROM "WorkoutDaySets" WHERE "TargetRepsMin" IS NULL OR ("IsSplit" AND "RightTargetRepsMin" IS NULL)) THEN
                    RAISE EXCEPTION 'Set rep targets before rolling back optional template reps.';
                  END IF;
                END $$;
                """
            );
            migrationBuilder.DropColumn(name: "IsSplit", table: "WorkoutDaySets");

            migrationBuilder.AlterColumn<int>(
                name: "TargetRepsMin",
                table: "WorkoutDaySets",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true
            );
        }
    }
}
